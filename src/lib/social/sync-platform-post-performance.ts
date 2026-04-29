/**
 * Sync normalized platform metrics for published campaign posts (additive; no fake data).
 */

import type { PlatformPerformanceSnapshot } from "@/lib/social/platform-performance-sync-contract";
import type { NormalizedDeploymentFeedback } from "@/lib/revenue-os/deployment-feedback-contract";
import { normalizePerformanceSnapshotToFeedback } from "@/lib/revenue-os/deployment-feedback-contract";
import { loadCampaignPostPublishContext } from "@/lib/social/campaign-post-publish";
import { fetchPlatformPostPerformanceSnapshot } from "@/lib/social/platform-performance-adapters";
import { eq, and, desc, isNotNull, ne } from "drizzle-orm";
import { campaignPosts, campaigns } from "@/lib/db/schema";

export type NormalizedPlatformPerformanceFields = Pick<
  NormalizedDeploymentFeedback,
  | "impressions"
  | "clicks"
  | "engagement"
  | "comments"
  | "shares"
  | "saves"
  | "leads"
  | "ctr"
  | "cpc"
  | "syncedAt"
  | "sourcePlatform"
>;

/**
 * Map a raw platform snapshot into normalized metric fields (+ syncedAt / sourcePlatform).
 */
export function normalizePlatformPerformanceSnapshot(
  snap: PlatformPerformanceSnapshot,
  sourcePlatform: string
): NormalizedPlatformPerformanceFields {
  return {
    impressions: snap.impressions ?? null,
    clicks: snap.clicks ?? null,
    engagement: snap.engagement ?? null,
    comments: snap.comments ?? null,
    shares: snap.shares ?? null,
    saves: snap.saves ?? null,
    leads: snap.leads ?? null,
    ctr: snap.ctr ?? null,
    cpc: snap.cpc ?? null,
    syncedAt: snap.capturedAt,
    sourcePlatform,
  };
}

export type SyncPlatformPostPerformanceResult =
  | {
      status: "synced";
      campaignPostId: string;
      userId: string;
      normalized: NormalizedDeploymentFeedback;
    }
  | { status: "skipped"; campaignPostId: string; reason: string }
  | { status: "unsupported"; campaignPostId: string; platform: string; reason: string }
  | { status: "failed"; campaignPostId: string; error: string };

/**
 * Load publish context and attempt metric fetch for one POSTED campaign post.
 */
export async function syncPlatformPostPerformanceForPost(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  campaignPostId: string
): Promise<SyncPlatformPostPerformanceResult> {
  const postRows = await db.select().from(campaignPosts).where(eq(campaignPosts.id, campaignPostId)).limit(1);
  if (postRows.length === 0) {
    return { status: "skipped", campaignPostId, reason: "post_not_found" };
  }
  const post = postRows[0];
  if (post.status !== "POSTED") {
    return { status: "skipped", campaignPostId, reason: "not_posted" };
  }
  if (!post.platformPostId?.trim()) {
    return { status: "skipped", campaignPostId, reason: "missing_platform_post_id" };
  }

  let ctx: Awaited<ReturnType<typeof loadCampaignPostPublishContext>>;
  try {
    ctx = await loadCampaignPostPublishContext(db, campaignPostId);
  } catch (e) {
    return {
      status: "failed",
      campaignPostId,
      error: e instanceof Error ? e.message : String(e),
    };
  }
  if (!ctx) {
    return { status: "failed", campaignPostId, error: "load_context_null" };
  }

  const platform = ctx.platformKey;
  const fetchRes = await fetchPlatformPostPerformanceSnapshot({
    platform,
    accessToken: ctx.accessToken,
    externalPostId: post.platformPostId,
  });

  if (fetchRes.status === "unsupported") {
    return {
      status: "unsupported",
      campaignPostId,
      platform,
      reason: fetchRes.reason,
    };
  }
  if (fetchRes.status === "error") {
    return { status: "failed", campaignPostId, error: fetchRes.message };
  }

  const fields = normalizePlatformPerformanceSnapshot(fetchRes.snapshot, platform);
  const pubAt =
    post.postedAt instanceof Date
      ? post.postedAt.toISOString()
      : post.postedAt
        ? String(post.postedAt)
        : null;

  const normalized = normalizePerformanceSnapshotToFeedback({
    campaignPostId: post.id,
    campaignId: post.campaignId,
    platform,
    source: "platform_sync",
    platformPostId: post.platformPostId,
    publishedAt: pubAt,
    impressions: fields.impressions,
    clicks: fields.clicks,
    engagement: fields.engagement,
    comments: fields.comments,
    shares: fields.shares,
    saves: fields.saves,
    leads: fields.leads,
    ctr: fields.ctr,
    cpc: fields.cpc,
    syncedAt: fields.syncedAt ?? undefined,
  });

  return {
    status: "synced",
    campaignPostId,
    userId: ctx.campaign.userId,
    normalized,
  };
}

export type SyncPlatformPostPerformanceForUserSummary = {
  scanned: number;
  synced: number;
  unsupported: number;
  failed: number;
  skipped: number;
};

/**
 * Scan recent POSTED posts for a user and persist metric snapshots when the platform adapter returns data.
 */
export async function syncPlatformPostPerformanceForUser(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  userId: string,
  opts?: { limit?: number }
): Promise<SyncPlatformPostPerformanceForUserSummary> {
  const { attachPerformanceFeedbackToCampaignPost } = await import("@/lib/revenue-os/deployment-feedback-db");
  const limit = Math.min(Math.max(opts?.limit ?? 15, 1), 100);
  const rows = await db
    .select({ postId: campaignPosts.id })
    .from(campaignPosts)
    .innerJoin(campaigns, eq(campaignPosts.campaignId, campaigns.id))
    .where(
      and(
        eq(campaigns.userId, String(userId)),
        eq(campaignPosts.status, "POSTED"),
        isNotNull(campaignPosts.platformPostId),
        ne(campaignPosts.platformPostId, "")
      )
    )
    .orderBy(desc(campaignPosts.postedAt))
    .limit(limit);

  const summary: SyncPlatformPostPerformanceForUserSummary = {
    scanned: rows.length,
    synced: 0,
    unsupported: 0,
    failed: 0,
    skipped: 0,
  };

  for (const r of rows) {
    try {
      const res = await syncPlatformPostPerformanceForPost(db, r.postId);
      if (res.status === "synced") {
        await attachPerformanceFeedbackToCampaignPost(db, res.userId, res.normalized);
        summary.synced += 1;
      } else if (res.status === "unsupported") summary.unsupported += 1;
      else if (res.status === "failed") summary.failed += 1;
      else summary.skipped += 1;
    } catch (e) {
      summary.failed += 1;
      console.error("[syncPlatformPostPerformanceForUser] post", r.postId, e);
    }
  }

  return summary;
}
