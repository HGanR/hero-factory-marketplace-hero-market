import { campaignAuditEvents } from "@/lib/db/schema";
import type { SocialPostTimelineDb } from "@/lib/social/social-post-audit-query";
import {
  CampaignPostPublishError,
  loadCampaignPostPublishContext,
  type CampaignPostPublishContext,
} from "@/lib/social/campaign-post-publish";
import { fetchPlatformPostPerformanceSnapshot } from "@/lib/social/platform-performance-adapters";
import { normalizePlatformSnapshotToPayload } from "@/lib/social/governed-post-analytics-normalize";
import { insertCampaignPostAnalyticsSnapshot } from "@/lib/social/governed-post-analytics-store";
import type { RefreshGovernedPostAnalyticsResult } from "@/lib/social/governed-post-analytics-types";

async function recordAnalyticsRefreshFailureAudit(
  db: SocialPostTimelineDb,
  args: { userId: string; postId: string; platform: string; message: string; detail?: string | null }
): Promise<void> {
  await db.insert(campaignAuditEvents).values({
    id: crypto.randomUUID(),
    userId: args.userId,
    postId: args.postId,
    action: "governed_post_analytics_refresh_failed",
    platform: args.platform,
    details: { message: args.message, detail: args.detail ?? null },
    createdAt: new Date(),
  });
}

/**
 * On-demand provider fetch + append snapshot. Only for `POSTED` rows with `platform_post_id`.
 */
export async function refreshGovernedPostAnalytics(args: {
  db: SocialPostTimelineDb;
  userId: string;
  postId: string;
}): Promise<RefreshGovernedPostAnalyticsResult> {
  const { db, userId, postId } = args;

  let ctx: CampaignPostPublishContext | null = null;
  try {
    ctx = await loadCampaignPostPublishContext(db, postId);
  } catch (e) {
    if (e instanceof CampaignPostPublishError) {
      if (e.code === "ACCOUNT_NOT_CONNECTED") {
        return { ok: false, code: "no_account", message: e.message };
      }
      if (e.code === "INVALID_PLATFORM" || e.code === "PLATFORM_UNSUPPORTED") {
        return { ok: false, code: "provider_unsupported", message: e.message };
      }
      if (e.code === "CAMPAIGN_NOT_FOUND") {
        return { ok: false, code: "not_found", message: e.message };
      }
    }
    throw e;
  }

  if (!ctx) {
    return { ok: false, code: "not_found", message: "Post not found." };
  }

  const post = ctx.post;
  const platform = ctx.platformKey;

  if (String(post.status || "").toUpperCase() !== "POSTED") {
    return { ok: false, code: "not_published", message: "Metrics refresh applies to published posts only." };
  }

  const ext = post.platformPostId?.trim();
  if (!ext) {
    return {
      ok: false,
      code: "missing_external_post_id",
      message: "Cannot fetch metrics without a remote post id (`platform_post_id`).",
    };
  }

  const fetchStatus = await fetchPlatformPostPerformanceSnapshot({
    platform,
    accessToken: ctx.accessToken,
    externalPostId: ext,
  });

  if (fetchStatus.status === "unsupported") {
    return {
      ok: false,
      code: "provider_unsupported",
      message: fetchStatus.reason,
    };
  }

  if (fetchStatus.status === "error") {
    await recordAnalyticsRefreshFailureAudit(db, {
      userId,
      postId,
      platform: post.platform,
      message: fetchStatus.message,
    });
    return {
      ok: false,
      code: "fetch_error",
      message: fetchStatus.message,
    };
  }

  const payload = normalizePlatformSnapshotToPayload(fetchStatus.snapshot);
  const id = crypto.randomUUID();
  const fetchedAt = new Date();

  await insertCampaignPostAnalyticsSnapshot(db, {
    id,
    campaignPostId: post.id,
    provider: platform,
    providerPostId: ext,
    snapshotType: "platform_lifetime",
    payload,
    fetchedAt,
  });

  return {
    ok: true,
    snapshot: {
      id,
      fetchedAt: fetchedAt.toISOString(),
      metrics: payload.normalized,
      sourceNotes: payload.sourceNotes,
      comparatorCaveat: payload.comparatorCaveat,
    },
  };
}
