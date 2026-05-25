import crypto from "crypto";
import { eq, and } from "drizzle-orm";
import { campaignPosts, campaigns, campaignAuditEvents, campaignAssets } from "@/lib/db/schema";
import {
  loadCampaignPostPublishContext,
  executeCampaignPostAdapterPublish,
  CampaignPostPublishError,
} from "@/lib/social/campaign-post-publish";
import { normalizeScheduledPublishFailure } from "@/lib/social/scheduled-publish-executor";
import { persistPublishOutcomeDeploymentFeedback } from "@/lib/revenue-os/deployment-feedback-db";
import { mergeRawScheduledPublishMeta, parseScheduledPublishMeta } from "@/lib/social/scheduled-publish-meta";
import type {
  PublishContent360PostInput,
  PublishContent360PostResult,
} from "@/lib/content360/publish-content360-post";
import { recordClientHubAutomationEvent } from "@/lib/revenue-os/client-hub-automation-events";
import { verifyToken, jwtPayloadIndicatesPlatformAdmin } from "@/lib/auth";

const PUBLISHABLE = new Set(["DRAFT", "SCHEDULED", "FAILED", "RETRY_SCHEDULED"]);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ManualPublishDb = any;

export type ManualPublishCoreDeps = {
  verifyToken: (token: string) => unknown;
  jwtPayloadIndicatesPlatformAdmin: (payload: unknown) => boolean;
  loadCampaignPostPublishContext: typeof loadCampaignPostPublishContext;
  executeCampaignPostAdapterPublish: typeof executeCampaignPostAdapterPublish;
  /** Omit in tests to avoid loading `publish-content360-post` (uses `server-only`). */
  publishContent360Post?: (input: PublishContent360PostInput) => Promise<PublishContent360PostResult>;
  persistPublishOutcomeDeploymentFeedback: typeof persistPublishOutcomeDeploymentFeedback;
  recordClientHubAutomationEvent: typeof recordClientHubAutomationEvent;
};

const defaultDeps: ManualPublishCoreDeps = {
  verifyToken,
  jwtPayloadIndicatesPlatformAdmin,
  loadCampaignPostPublishContext,
  executeCampaignPostAdapterPublish,
  persistPublishOutcomeDeploymentFeedback,
  recordClientHubAutomationEvent,
};

async function resolvePublishContent360Post(
  dep?: ManualPublishCoreDeps["publishContent360Post"],
): Promise<NonNullable<ManualPublishCoreDeps["publishContent360Post"]>> {
  if (dep) return dep;
  const m = await import("@/lib/content360/publish-content360-post");
  return m.publishContent360Post;
}

export type ManualPublishCoreResult = { status: number; body: Record<string, unknown> };

/**
 * Shared manual publish logic for `POST /api/campaigns/posts/:postId/publish` (testable without Jest).
 */
export async function runManualCampaignPostPublishCore(args: {
  userId: number;
  postId: string;
  adminTokenCookie: string | undefined;
  db: ManualPublishDb;
  deps?: Partial<ManualPublishCoreDeps>;
}): Promise<ManualPublishCoreResult> {
  const { userId, postId, adminTokenCookie, db } = args;
  const d = { ...defaultDeps, ...args.deps };

  const postRows = await db.select().from(campaignPosts).where(eq(campaignPosts.id, postId)).limit(1);

  if (postRows.length === 0) {
    return { status: 404, body: { error: "Post not found" } };
  }

  const post = postRows[0];
  if (post.status === "POSTED") {
    return {
      status: 400,
      body: { error: "ALREADY_POSTED", message: "Post is already published." },
    };
  }
  if (post.status === "PUBLISHING") {
    return {
      status: 409,
      body: { error: "IN_PROGRESS", message: "Publish already in progress — wait or retry shortly." },
    };
  }
  if (!PUBLISHABLE.has(String(post.status))) {
    return {
      status: 400,
      body: { error: "INVALID_STATUS", message: `Cannot publish from status ${post.status}.` },
    };
  }

  const publishMeta = parseScheduledPublishMeta(post.scheduledPublishMeta);
  const isAdminContent360Publish =
    publishMeta.publishRoute === "content360" &&
    (() => {
      const adminTok = adminTokenCookie?.trim();
      if (!adminTok) return false;
      const p = d.verifyToken(adminTok);
      return d.jwtPayloadIndicatesPlatformAdmin(p);
    })();

  const campRows = await db
    .select()
    .from(campaigns)
    .where(
      isAdminContent360Publish
        ? eq(campaigns.id, post.campaignId)
        : and(eq(campaigns.id, post.campaignId), eq(campaigns.userId, String(userId))),
    )
    .limit(1);

  if (campRows.length === 0) {
    return { status: 404, body: { error: "Campaign not found" } };
  }

  if (publishMeta.publishRoute === "content360" && !isAdminContent360Publish) {
    return {
      status: 403,
      body: {
        error: "FORBIDDEN",
        message:
          "Posts routed to Content360 must be published by a platform administrator session (admin login with admin-token).",
        code: "CONTENT360_ADMIN_REQUIRED",
      },
    };
  }

  await db
    .update(campaignPosts)
    .set({ status: "PUBLISHING", updatedAt: new Date() })
    .where(eq(campaignPosts.id, postId));

  try {
    if (publishMeta.publishRoute === "content360") {
      let mediaUrl: string | null = null;
      if (post.assetId) {
        const assets = await db.select().from(campaignAssets).where(eq(campaignAssets.id, post.assetId)).limit(1);
        mediaUrl = assets[0]?.storageUrl ?? null;
      }
      const platformSlug = (publishMeta.targetPlatform || post.platform || "").trim().toLowerCase();
      const platforms = platformSlug ? [platformSlug] : ["instagram"];

        const c360 = await (await resolvePublishContent360Post(d.publishContent360Post))({
        caption: post.caption ?? "",
        mediaUrl,
        scheduledAt: null,
        platforms,
        campaignId: post.campaignId,
        postId,
        metadata: {
          utmParams: post.utmParams,
          linkUrl: post.linkUrl,
          publishSource: "manual_admin_content360",
          operatorUserId: String(userId),
        },
      });

      if (!c360.ok) {
        throw new CampaignPostPublishError(
          c360.code || "CONTENT360_PUBLISH_FAILED",
          c360.message || "Content360 publish failed.",
        );
      }

      const nextMeta = mergeRawScheduledPublishMeta(post.scheduledPublishMeta, {
        content360PlatformPublish: true,
        content360ProviderResponse: c360.providerMetadata,
      });

      await db
        .update(campaignPosts)
        .set({
          status: "POSTED",
          platformPostId: c360.platformPostId,
          postedAt: new Date(),
          errorMessage: null,
          scheduledPublishMeta: nextMeta,
          updatedAt: new Date(),
        })
        .where(eq(campaignPosts.id, postId));

      const platformKey = platformSlug || String(post.platform);

      await db.insert(campaignAuditEvents).values({
        id: crypto.randomUUID(),
        userId: String(userId),
        postId,
        action: "publish",
        platform: platformKey,
        details: {
          platformPostId: c360.platformPostId,
          source: "manual_content360_platform",
          publishRoute: "content360",
        },
      });

      await d.persistPublishOutcomeDeploymentFeedback(db, {
        userId: String(userId),
        campaignId: post.campaignId,
        campaignPostId: postId,
        platform: platformKey,
        outcome: "published",
        source: "manual_publish_content360",
        publishedAt: new Date(),
        platformPostId: c360.platformPostId,
      });

      const cid = campRows[0].clientId;
      if (cid && String(cid).trim()) {
        await d.recordClientHubAutomationEvent(userId, String(cid).trim(), "post_published", {
          refId: postId,
          metadata: {
            summary: `${platformKey} post published via Content360 (platform)`,
            platform: platformKey,
            campaignId: post.campaignId,
            platformPostId: c360.platformPostId,
          },
        });
      }

      return {
        status: 200,
        body: {
          ok: true,
          platformPostId: c360.platformPostId,
          status: "POSTED",
          publishRoute: "content360",
        },
      };
    }

    const ctx = await d.loadCampaignPostPublishContext(db, postId);
    if (!ctx) {
      throw new CampaignPostPublishError("POST_NOT_FOUND", "Post not found.");
    }

    const result = await d.executeCampaignPostAdapterPublish(ctx);

    await db
      .update(campaignPosts)
      .set({
        status: "POSTED",
        platformPostId: result.platformPostId,
        postedAt: new Date(),
        errorMessage: null,
        scheduledPublishMeta: {},
        updatedAt: new Date(),
      })
      .where(eq(campaignPosts.id, postId));

    await db.insert(campaignAuditEvents).values({
      id: crypto.randomUUID(),
      userId: String(userId),
      postId,
      action: "publish",
      platform: ctx.platformKey,
      details: { platformPostId: result.platformPostId, source: "manual" },
    });

    await d.persistPublishOutcomeDeploymentFeedback(db, {
      userId: String(userId),
      campaignId: post.campaignId,
      campaignPostId: postId,
      platform: ctx.platformKey,
      outcome: "published",
      source: "manual_publish",
      publishedAt: new Date(),
      platformPostId: result.platformPostId,
    });

    const cid = campRows[0].clientId;
    if (cid && String(cid).trim()) {
      await d.recordClientHubAutomationEvent(userId, String(cid).trim(), "post_published", {
        refId: postId,
        metadata: {
          summary: `${ctx.platformKey} post published`,
          platform: ctx.platformKey,
          campaignId: post.campaignId,
          platformPostId: result.platformPostId,
        },
      });
    }

    return {
      status: 200,
      body: { ok: true, platformPostId: result.platformPostId, status: "POSTED" },
    };
  } catch (err) {
    const norm =
      err instanceof CampaignPostPublishError
        ? normalizeScheduledPublishFailure(err, err.code)
        : normalizeScheduledPublishFailure(err);

    await db
      .update(campaignPosts)
      .set({
        status: "FAILED",
        errorMessage: norm.message,
        updatedAt: new Date(),
      })
      .where(eq(campaignPosts.id, postId));

    let platform: string | null = null;
    try {
      if (publishMeta.publishRoute !== "content360") {
        const ctx = await d.loadCampaignPostPublishContext(db, postId);
        platform = ctx?.platformKey ?? null;
      } else {
        platform = (publishMeta.targetPlatform || post.platform || "").trim() || null;
      }
    } catch {
      /* ignore */
    }

    await db.insert(campaignAuditEvents).values({
      id: crypto.randomUUID(),
      userId: String(userId),
      postId,
      action: "fail",
      platform,
      details: { error: norm.message, code: norm.code, source: "manual" },
    });

    await d.persistPublishOutcomeDeploymentFeedback(db, {
      userId: String(userId),
      campaignId: post.campaignId,
      campaignPostId: postId,
      platform: platform ?? String(post.platform),
      outcome: "failed",
      source: "manual_publish",
      errorCode: norm.code,
      errorMessage: norm.message,
    });

    return {
      status: 502,
      body: { error: "PUBLISH_FAILED", message: norm.message, code: norm.code },
    };
  }
}
