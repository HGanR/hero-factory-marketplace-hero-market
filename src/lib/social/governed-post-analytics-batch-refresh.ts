/**
 * Bounded batch orchestration for governed post analytics refresh (Part 45).
 * Delegates each attempt to `refreshGovernedPostAnalytics` — no duplicated provider fetch logic.
 */

import { campaignAuditEvents } from "@/lib/db/schema";
import type { CampaignPostRow } from "@/lib/db/schema";
import { campaignPosts } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import type { SocialPostTimelineDb } from "@/lib/social/social-post-audit-query";
import { refreshGovernedPostAnalytics } from "@/lib/social/governed-post-analytics-refresh";
import { getPlatformMetricSyncSupportState } from "@/lib/social/platform-performance-adapters";
import { normalizeCampaignPostPlatformForPublish } from "@/lib/social/platform-identity";
import { isGovernedSocialPublishPlatform } from "@/lib/social/social-governed-platforms";

export const DEFAULT_CAMPAIGN_ANALYTICS_BATCH_LIMIT = 25;
export const MAX_CAMPAIGN_ANALYTICS_BATCH_LIMIT = 50;

export const GOVERNED_POST_ANALYTICS_BATCH_REFRESHED_ACTION = "governed_post_analytics_batch_refreshed" as const;

/** Skip reasons that never trigger a provider call. */
export type BatchAnalyticsRefreshSkipReason =
  | "unpublished"
  | "unsupported_provider"
  | "missing_remote_post_id"
  | "deferred_due_to_batch_limit";

export type BatchAnalyticsRefreshFailure = {
  postId: string;
  code: string;
  message: string;
};

export type CampaignGovernedPostAnalyticsBatchRefreshResult = {
  campaignId: string;
  limitRequested: number;
  limitApplied: number;
  /** Posts we called `refreshGovernedPostAnalytics` for. */
  attemptedCount: number;
  succeededCount: number;
  failedCount: number;
  skippedCount: number;
  skippedBreakdown: Record<BatchAnalyticsRefreshSkipReason, number>;
  refreshedPostIds: string[];
  failures: BatchAnalyticsRefreshFailure[];
  startedAt: string;
  finishedAt: string;
  durationMs: number;
};

export type PostRowBatchFields = Pick<
  CampaignPostRow,
  "id" | "status" | "platform" | "platformPostId" | "postedAt" | "createdAt"
>;

export function isPostedRow(post: PostRowBatchFields): boolean {
  return String(post.status || "").toUpperCase() === "POSTED";
}

export function isGovernedRow(post: PostRowBatchFields): boolean {
  const key = normalizeCampaignPostPlatformForPublish(post.platform);
  return !!(key && isGovernedSocialPublishPlatform(key));
}

/**
 * Eligibility for a **published** governed row only (after filtering to POSTED).
 */
export function classifyPublishedGovernedPostForBatchRefresh(
  post: PostRowBatchFields
): { kind: "eligible" } | { kind: "skip"; reason: Exclude<BatchAnalyticsRefreshSkipReason, "unpublished"> } {
  const key = normalizeCampaignPostPlatformForPublish(post.platform);
  if (!key || !isGovernedSocialPublishPlatform(key)) {
    return { kind: "skip", reason: "unsupported_provider" };
  }
  if (getPlatformMetricSyncSupportState(key) !== "live") {
    return { kind: "skip", reason: "unsupported_provider" };
  }
  if (!post.platformPostId?.trim()) {
    return { kind: "skip", reason: "missing_remote_post_id" };
  }
  return { kind: "eligible" };
}

/** Deterministic: oldest `postedAt` first, then `createdAt`. */
export function sortPublishedGovernedPostsForBatchRefresh(posts: PostRowBatchFields[]): PostRowBatchFields[] {
  return [...posts].sort((a, b) => {
    const ta = a.postedAt ? new Date(a.postedAt as Date).getTime() : 0;
    const tb = b.postedAt ? new Date(b.postedAt as Date).getTime() : 0;
    if (ta !== tb) return ta - tb;
    return new Date(a.createdAt as Date).getTime() - new Date(b.createdAt as Date).getTime();
  });
}

function emptyBreakdown(): Record<BatchAnalyticsRefreshSkipReason, number> {
  return {
    unpublished: 0,
    unsupported_provider: 0,
    missing_remote_post_id: 0,
    deferred_due_to_batch_limit: 0,
  };
}

/**
 * Pure planning step for tests: counts skips and lists post ids to refresh (capped).
 */
export function planCampaignGovernedPostAnalyticsBatchRefresh(args: {
  posts: PostRowBatchFields[];
  limit: number;
}): {
  postIdsToAttempt: string[];
  skippedBreakdown: Record<BatchAnalyticsRefreshSkipReason, number>;
  skippedCount: number;
} {
  const lim = Math.min(Math.max(args.limit, 1), MAX_CAMPAIGN_ANALYTICS_BATCH_LIMIT);
  const breakdown = emptyBreakdown();
  const governed = args.posts.filter(isGovernedRow);
  for (const p of governed) {
    if (!isPostedRow(p)) {
      breakdown.unpublished += 1;
    }
  }
  const publishedGoverned = governed.filter(isPostedRow);
  const ordered = sortPublishedGovernedPostsForBatchRefresh(publishedGoverned);
  const postIdsToAttempt: string[] = [];

  for (const p of ordered) {
    const c = classifyPublishedGovernedPostForBatchRefresh(p);
    if (c.kind === "skip") {
      breakdown[c.reason] += 1;
      continue;
    }
    if (postIdsToAttempt.length < lim) {
      postIdsToAttempt.push(p.id);
    } else {
      breakdown.deferred_due_to_batch_limit += 1;
    }
  }

  const skippedCount =
    breakdown.unpublished +
    breakdown.unsupported_provider +
    breakdown.missing_remote_post_id +
    breakdown.deferred_due_to_batch_limit;

  return { postIdsToAttempt, skippedBreakdown: breakdown, skippedCount };
}

function mapRefreshFailureToBatchFailure(
  postId: string,
  code: string,
  message: string
): BatchAnalyticsRefreshFailure {
  return { postId, code, message };
}

export async function insertGovernedPostAnalyticsBatchRefreshAudit(args: {
  db: SocialPostTimelineDb;
  userId: string;
  details: Record<string, unknown>;
}): Promise<void> {
  await args.db.insert(campaignAuditEvents).values({
    id: crypto.randomUUID(),
    userId: args.userId,
    postId: null,
    action: GOVERNED_POST_ANALYTICS_BATCH_REFRESHED_ACTION,
    platform: "governed_social",
    details: args.details,
    createdAt: new Date(),
  });
}

export async function runCampaignGovernedPostAnalyticsBatchRefresh(args: {
  db: SocialPostTimelineDb;
  userId: string;
  campaignId: string;
  limit?: number;
}): Promise<CampaignGovernedPostAnalyticsBatchRefreshResult> {
  const started = Date.now();
  const startedIso = new Date(started).toISOString();
  const limitRequested = args.limit ?? DEFAULT_CAMPAIGN_ANALYTICS_BATCH_LIMIT;
  const limitApplied = Math.min(Math.max(limitRequested, 1), MAX_CAMPAIGN_ANALYTICS_BATCH_LIMIT);

  const rows = await args.db
    .select({
      id: campaignPosts.id,
      status: campaignPosts.status,
      platform: campaignPosts.platform,
      platformPostId: campaignPosts.platformPostId,
      postedAt: campaignPosts.postedAt,
      createdAt: campaignPosts.createdAt,
    })
    .from(campaignPosts)
    .where(eq(campaignPosts.campaignId, args.campaignId));

  const plan = planCampaignGovernedPostAnalyticsBatchRefresh({
    posts: rows,
    limit: limitApplied,
  });

  let succeededCount = 0;
  let failedCount = 0;
  const refreshedPostIds: string[] = [];
  const failures: BatchAnalyticsRefreshFailure[] = [];
  const maxFailureDetails = 12;

  for (const postId of plan.postIdsToAttempt) {
    const result = await refreshGovernedPostAnalytics({
      db: args.db,
      userId: args.userId,
      postId,
    });
    if (result.ok) {
      succeededCount += 1;
      refreshedPostIds.push(postId);
    } else {
      failedCount += 1;
      if (failures.length < maxFailureDetails) {
        failures.push(mapRefreshFailureToBatchFailure(postId, result.code, result.message));
      }
    }
  }

  const finished = Date.now();
  const finishedIso = new Date(finished).toISOString();

  return {
    campaignId: args.campaignId,
    limitRequested,
    limitApplied,
    attemptedCount: plan.postIdsToAttempt.length,
    succeededCount,
    failedCount,
    skippedCount: plan.skippedCount,
    skippedBreakdown: plan.skippedBreakdown,
    refreshedPostIds,
    failures,
    startedAt: startedIso,
    finishedAt: finishedIso,
    durationMs: finished - started,
  };
}
