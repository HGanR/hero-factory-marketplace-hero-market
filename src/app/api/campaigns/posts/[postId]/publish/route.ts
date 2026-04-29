import { NextRequest, NextResponse } from "next/server";
import { getAuthedUserId } from "@/lib/api/auth";
import { getDb } from "@/lib/db";
import { campaignPosts, campaigns, campaignAuditEvents } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import crypto from "crypto";
import {
  loadCampaignPostPublishContext,
  executeCampaignPostAdapterPublish,
  CampaignPostPublishError,
} from "@/lib/social/campaign-post-publish";
import { normalizeScheduledPublishFailure } from "@/lib/social/scheduled-publish-executor";
import { persistPublishOutcomeDeploymentFeedback } from "@/lib/revenue-os/deployment-feedback-db";

import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
import { recordClientHubAutomationEvent } from "@/lib/revenue-os/client-hub-automation-events";
const PUBLISHABLE = new Set(["DRAFT", "SCHEDULED", "FAILED", "RETRY_SCHEDULED"]);

/**
 * POST /api/campaigns/posts/:postId/publish
 * Publish now (manual). Scheduled worker uses the same adapter path internally.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  const __rosGate = await enforceRevenueOsApiAccess(req);
  if (__rosGate) return __rosGate;
  try {
    const userId = await getAuthedUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { postId } = await params;
    if (!postId) {
      return NextResponse.json({ error: "Missing postId" }, { status: 400 });
    }

    const db = await getDb();

    const postRows = await db
      .select()
      .from(campaignPosts)
      .where(eq(campaignPosts.id, postId))
      .limit(1);

    if (postRows.length === 0) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    const post = postRows[0];
    if (post.status === "POSTED") {
      return NextResponse.json({ error: "ALREADY_POSTED", message: "Post is already published." }, { status: 400 });
    }
    if (post.status === "PUBLISHING") {
      return NextResponse.json(
        { error: "IN_PROGRESS", message: "Publish already in progress — wait or retry shortly." },
        { status: 409 }
      );
    }
    if (!PUBLISHABLE.has(String(post.status))) {
      return NextResponse.json(
        { error: "INVALID_STATUS", message: `Cannot publish from status ${post.status}.` },
        { status: 400 }
      );
    }

    const campRows = await db
      .select()
      .from(campaigns)
      .where(
        and(
          eq(campaigns.id, post.campaignId),
          eq(campaigns.userId, String(userId))
        )
      )
      .limit(1);

    if (campRows.length === 0) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    await db
      .update(campaignPosts)
      .set({ status: "PUBLISHING", updatedAt: new Date() })
      .where(eq(campaignPosts.id, postId));

    try {
      const ctx = await loadCampaignPostPublishContext(db, postId);
      if (!ctx) {
        throw new CampaignPostPublishError("POST_NOT_FOUND", "Post not found.");
      }

      const result = await executeCampaignPostAdapterPublish(ctx);

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

      await persistPublishOutcomeDeploymentFeedback(db, {
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
        await recordClientHubAutomationEvent(userId, String(cid).trim(), "post_published", {
          refId: postId,
          metadata: {
            summary: `${ctx.platformKey} post published`,
            platform: ctx.platformKey,
            campaignId: post.campaignId,
            platformPostId: result.platformPostId,
          },
        });
      }

      return NextResponse.json({
        ok: true,
        platformPostId: result.platformPostId,
        status: "POSTED",
      });
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
        const ctx = await loadCampaignPostPublishContext(db, postId);
        platform = ctx?.platformKey ?? null;
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

      await persistPublishOutcomeDeploymentFeedback(db, {
        userId: String(userId),
        campaignId: post.campaignId,
        campaignPostId: postId,
        platform: platform ?? String(post.platform),
        outcome: "failed",
        source: "manual_publish",
        errorCode: norm.code,
        errorMessage: norm.message,
      });

      return NextResponse.json(
        { error: "PUBLISH_FAILED", message: norm.message, code: norm.code },
        { status: 502 }
      );
    }
  } catch (e) {
    console.error("[campaigns/posts/publish]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
