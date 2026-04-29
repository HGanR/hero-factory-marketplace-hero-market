/**
 * Cron/worker orchestration: bounded governed post analytics refresh with freshness priority (Part 46),
 * provider-aware caps / throttle backoff, and env-driven limits (Part 47).
 * Reuses `refreshGovernedPostAnalytics` per attempt — no duplicate provider/storage logic.
 */

import { campaignAuditEvents, campaignPosts } from "@/lib/db/schema";
import { and, desc, eq, isNotNull, ne } from "drizzle-orm";
import type { SocialPlatform } from "@/lib/social/config";
import type { SocialPostTimelineDb } from "@/lib/social/social-post-audit-query";
import {
  classifyPublishedGovernedPostForBatchRefresh,
  isGovernedRow,
  isPostedRow,
  type PostRowBatchFields,
} from "@/lib/social/governed-post-analytics-batch-refresh";
import { classifyGovernedPostAnalyticsRefreshFailure } from "@/lib/social/governed-post-analytics-refresh-failure-policy";
import { getLatestAnalyticsSnapshotRowsForPostIds } from "@/lib/social/governed-post-analytics-store";
import { refreshGovernedPostAnalytics } from "@/lib/social/governed-post-analytics-refresh";
import { normalizeCampaignPostPlatformForPublish } from "@/lib/social/platform-identity";

export const GOVERNED_POST_ANALYTICS_SCHEDULED_REFRESH_RAN_ACTION = "governed_post_analytics_scheduled_refresh_ran" as const;

/** Code defaults when env is unset (unchanged from Part 46). */
export const SCHEDULED_GOVERNED_ANALYTICS_DEFAULT_SCAN_POOL_LIMIT = 500;
export const SCHEDULED_GOVERNED_ANALYTICS_MAX_SCAN_POOL_LIMIT = 2000;
export const SCHEDULED_GOVERNED_ANALYTICS_DEFAULT_MAX_POSTS = 40;
export const SCHEDULED_GOVERNED_ANALYTICS_MAX_POSTS_HARD = 200;
export const SCHEDULED_GOVERNED_ANALYTICS_DEFAULT_MAX_POSTS_PER_CAMPAIGN = 10;
export const SCHEDULED_GOVERNED_ANALYTICS_MAX_POSTS_PER_CAMPAIGN_HARD = 50;
export const SCHEDULED_GOVERNED_ANALYTICS_DEFAULT_MAX_CAMPAIGNS = 25;
export const SCHEDULED_GOVERNED_ANALYTICS_MAX_CAMPAIGNS_HARD = 200;
export const SCHEDULED_GOVERNED_ANALYTICS_DEFAULT_MAX_PER_PROVIDER = 20;
export const SCHEDULED_GOVERNED_ANALYTICS_MAX_PER_PROVIDER_HARD = 100;
export const SCHEDULED_GOVERNED_ANALYTICS_DEFAULT_THROTTLE_PAUSE_AFTER = 2;
export const SCHEDULED_GOVERNED_ANALYTICS_THROTTLE_PAUSE_AFTER_MIN = 1;
export const SCHEDULED_GOVERNED_ANALYTICS_THROTTLE_PAUSE_AFTER_HARD = 30;

/** Env var names (documented in social-performance-analytics.md). */
export const SCHEDULED_GOVERNED_ANALYTICS_ENV = {
  scanPoolLimit: "SCHEDULED_GOVERNED_ANALYTICS_SCAN_POOL_LIMIT",
  maxPosts: "SCHEDULED_GOVERNED_ANALYTICS_MAX_POSTS",
  maxPostsPerCampaign: "SCHEDULED_GOVERNED_ANALYTICS_MAX_POSTS_PER_CAMPAIGN",
  maxCampaigns: "SCHEDULED_GOVERNED_ANALYTICS_MAX_CAMPAIGNS",
  maxPerProvider: "SCHEDULED_GOVERNED_ANALYTICS_MAX_PER_PROVIDER",
  throttlePauseAfter: "SCHEDULED_GOVERNED_ANALYTICS_PROVIDER_THROTTLE_PAUSE_AFTER",
} as const;

export type PostRowScheduledFields = PostRowBatchFields & { campaignId: string };

export type EligiblePostWithFreshness = PostRowScheduledFields & {
  /** Null = no snapshot row (never synced). */
  latestFetchedAt: Date | null;
};

export type ScheduledRefreshPerProviderMetrics = {
  attempted: number;
  succeeded: number;
  failed: number;
  throttled: number;
};

function comparePostedThenCreated(a: PostRowBatchFields, b: PostRowBatchFields): number {
  const ta = a.postedAt ? new Date(a.postedAt as Date).getTime() : 0;
  const tb = b.postedAt ? new Date(b.postedAt as Date).getTime() : 0;
  if (ta !== tb) return ta - tb;
  return new Date(a.createdAt as Date).getTime() - new Date(b.createdAt as Date).getTime();
}

/**
 * Published + live-eligible posts only. Order:
 * 1) Never synced (no latest snapshot) first, then oldest postedAt / createdAt within that band.
 * 2) Then posts with snapshots, stalest `fetched_at` first, then same tie-breakers.
 */
export function sortEligiblePostsForScheduledRefresh(
  eligible: PostRowScheduledFields[],
  latestFetchedAtByPostId: Map<string, Date | null>
): EligiblePostWithFreshness[] {
  const withFresh: EligiblePostWithFreshness[] = eligible.map((p) => ({
    ...p,
    latestFetchedAt: latestFetchedAtByPostId.get(p.id) ?? null,
  }));

  return withFresh.sort((a, b) => {
    const aSynced = a.latestFetchedAt != null;
    const bSynced = b.latestFetchedAt != null;
    if (!aSynced && bSynced) return -1;
    if (aSynced && !bSynced) return 1;
    if (!aSynced && !bSynced) {
      return comparePostedThenCreated(a, b);
    }
    const fa = a.latestFetchedAt!.getTime();
    const fb = b.latestFetchedAt!.getTime();
    if (fa !== fb) return fa - fb;
    return comparePostedThenCreated(a, b);
  });
}

export type ScheduledRefreshSelectionResult = {
  postIdsToAttempt: string[];
  deferredDueToBatchLimit: number;
  deferredDueToCampaignLimit: number;
  deferredDueToMaxCampaigns: number;
};

/**
 * Walk freshness-ordered eligible posts; enforce global, per-campaign, and distinct-campaign caps.
 * (Used in tests; scheduled run uses an extended loop with provider limits.)
 */
export function selectScheduledAnalyticsRefreshAttempts(args: {
  orderedEligible: EligiblePostWithFreshness[];
  maxPosts: number;
  maxPostsPerCampaign: number;
  maxCampaigns: number;
}): ScheduledRefreshSelectionResult {
  const postIdsToAttempt: string[] = [];
  let deferredDueToBatchLimit = 0;
  let deferredDueToCampaignLimit = 0;
  let deferredDueToMaxCampaigns = 0;

  const perCampaign = new Map<string, number>();
  const campaignsWithAttempts = new Set<string>();
  let attempts = 0;

  for (const p of args.orderedEligible) {
    const c = p.campaignId;
    const isNew = !campaignsWithAttempts.has(c);
    if (isNew && campaignsWithAttempts.size >= args.maxCampaigns) {
      deferredDueToMaxCampaigns += 1;
      continue;
    }
    const cnt = perCampaign.get(c) ?? 0;
    if (cnt >= args.maxPostsPerCampaign) {
      deferredDueToCampaignLimit += 1;
      continue;
    }
    if (attempts >= args.maxPosts) {
      deferredDueToBatchLimit += 1;
      continue;
    }
    postIdsToAttempt.push(p.id);
    attempts += 1;
    perCampaign.set(c, cnt + 1);
    campaignsWithAttempts.add(c);
  }

  return {
    postIdsToAttempt,
    deferredDueToBatchLimit,
    deferredDueToCampaignLimit,
    deferredDueToMaxCampaigns,
  };
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(Math.max(n, lo), hi);
}

function parseEnvInt(name: string, fallback: number, lo: number, hi: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return clamp(fallback, lo, hi);
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) return clamp(fallback, lo, hi);
  return clamp(n, lo, hi);
}

function limitOverride(
  override: number | undefined,
  envName: string,
  def: number,
  lo: number,
  hi: number
): number {
  if (override !== undefined) return clamp(override, lo, hi);
  return parseEnvInt(envName, def, lo, hi);
}

export type ResolvedScheduledGovernedAnalyticsLimits = {
  scanPoolLimit: number;
  maxPosts: number;
  maxPostsPerCampaign: number;
  maxCampaigns: number;
  maxPerProvider: number;
  throttlePauseAfter: number;
};

/** Resolve limits: HTTP/body overrides beat env, env beats code defaults. All clamped. */
export function resolveScheduledGovernedAnalyticsLimits(opts?: {
  scanPoolLimit?: number;
  maxPosts?: number;
  maxPostsPerCampaign?: number;
  maxCampaigns?: number;
  maxPerProvider?: number;
  throttlePauseAfter?: number;
}): ResolvedScheduledGovernedAnalyticsLimits {
  return {
    scanPoolLimit: limitOverride(
      opts?.scanPoolLimit,
      SCHEDULED_GOVERNED_ANALYTICS_ENV.scanPoolLimit,
      SCHEDULED_GOVERNED_ANALYTICS_DEFAULT_SCAN_POOL_LIMIT,
      1,
      SCHEDULED_GOVERNED_ANALYTICS_MAX_SCAN_POOL_LIMIT
    ),
    maxPosts: limitOverride(
      opts?.maxPosts,
      SCHEDULED_GOVERNED_ANALYTICS_ENV.maxPosts,
      SCHEDULED_GOVERNED_ANALYTICS_DEFAULT_MAX_POSTS,
      1,
      SCHEDULED_GOVERNED_ANALYTICS_MAX_POSTS_HARD
    ),
    maxPostsPerCampaign: limitOverride(
      opts?.maxPostsPerCampaign,
      SCHEDULED_GOVERNED_ANALYTICS_ENV.maxPostsPerCampaign,
      SCHEDULED_GOVERNED_ANALYTICS_DEFAULT_MAX_POSTS_PER_CAMPAIGN,
      1,
      SCHEDULED_GOVERNED_ANALYTICS_MAX_POSTS_PER_CAMPAIGN_HARD
    ),
    maxCampaigns: limitOverride(
      opts?.maxCampaigns,
      SCHEDULED_GOVERNED_ANALYTICS_ENV.maxCampaigns,
      SCHEDULED_GOVERNED_ANALYTICS_DEFAULT_MAX_CAMPAIGNS,
      1,
      SCHEDULED_GOVERNED_ANALYTICS_MAX_CAMPAIGNS_HARD
    ),
    maxPerProvider: limitOverride(
      opts?.maxPerProvider,
      SCHEDULED_GOVERNED_ANALYTICS_ENV.maxPerProvider,
      SCHEDULED_GOVERNED_ANALYTICS_DEFAULT_MAX_PER_PROVIDER,
      1,
      SCHEDULED_GOVERNED_ANALYTICS_MAX_PER_PROVIDER_HARD
    ),
    throttlePauseAfter: limitOverride(
      opts?.throttlePauseAfter,
      SCHEDULED_GOVERNED_ANALYTICS_ENV.throttlePauseAfter,
      SCHEDULED_GOVERNED_ANALYTICS_DEFAULT_THROTTLE_PAUSE_AFTER,
      SCHEDULED_GOVERNED_ANALYTICS_THROTTLE_PAUSE_AFTER_MIN,
      SCHEDULED_GOVERNED_ANALYTICS_THROTTLE_PAUSE_AFTER_HARD
    ),
  };
}

export type RunScheduledGovernedPostAnalyticsRefreshSummary = {
  ok: true;
  scanPoolLimit: number;
  poolScanned: number;
  eligibleInPool: number;
  skippedInPool: number;
  campaignsInPool: number;
  campaignsTouched: number;
  attemptedCount: number;
  succeededCount: number;
  failedCount: number;
  throttledCount: number;
  deferredDueToBatchLimit: number;
  deferredDueToCampaignLimit: number;
  deferredDueToMaxCampaigns: number;
  deferredDueToPerProviderCap: number;
  deferredDueToProviderBackoff: number;
  durationMs: number;
  startedAt: string;
  finishedAt: string;
  maxPostsApplied: number;
  maxPostsPerCampaignApplied: number;
  maxCampaignsApplied: number;
  maxPerProviderApplied: number;
  throttlePauseAfterApplied: number;
  perProviderSummary: Record<string, ScheduledRefreshPerProviderMetrics>;
  failureSamples: Array<{
    postId: string;
    code: string;
    message: string;
    category?: string;
  }>;
};

function scheduledWorkerUserId(): string {
  return process.env.GOVERNED_ANALYTICS_SCHEDULED_USER_ID?.trim() || "0";
}

function emptyProviderMetrics(): ScheduledRefreshPerProviderMetrics {
  return { attempted: 0, succeeded: 0, failed: 0, throttled: 0 };
}

export async function insertGovernedPostAnalyticsScheduledRefreshAudit(args: {
  db: SocialPostTimelineDb;
  userId: string;
  details: Record<string, unknown>;
}): Promise<void> {
  await args.db.insert(campaignAuditEvents).values({
    id: crypto.randomUUID(),
    userId: args.userId,
    postId: null,
    action: GOVERNED_POST_ANALYTICS_SCHEDULED_REFRESH_RAN_ACTION,
    platform: "governed_social",
    details: args.details,
    createdAt: new Date(),
  });
}

/**
 * Load recent POSTED rows with non-empty `platform_post_id`, filter to governed live-eligible in memory,
 * prioritize freshness, run bounded refreshes with per-provider caps and throttle backoff.
 *
 * **Pool selection:** newest `posted_at` first up to `scanPoolLimit` — then **re-sorted** by freshness rules.
 */
export async function runScheduledGovernedPostAnalyticsRefresh(
  db: SocialPostTimelineDb,
  opts?: {
    scanPoolLimit?: number;
    maxPosts?: number;
    maxPostsPerCampaign?: number;
    maxCampaigns?: number;
    maxPerProvider?: number;
    throttlePauseAfter?: number;
  }
): Promise<RunScheduledGovernedPostAnalyticsRefreshSummary> {
  const started = Date.now();
  const startedIso = new Date(started).toISOString();

  const L = resolveScheduledGovernedAnalyticsLimits(opts);

  const poolRows = await db
    .select({
      id: campaignPosts.id,
      campaignId: campaignPosts.campaignId,
      status: campaignPosts.status,
      platform: campaignPosts.platform,
      platformPostId: campaignPosts.platformPostId,
      postedAt: campaignPosts.postedAt,
      createdAt: campaignPosts.createdAt,
    })
    .from(campaignPosts)
    .where(
      and(
        eq(campaignPosts.status, "POSTED"),
        isNotNull(campaignPosts.platformPostId),
        ne(campaignPosts.platformPostId, "")
      )
    )
    .orderBy(desc(campaignPosts.postedAt))
    .limit(L.scanPoolLimit);

  let skippedInPool = 0;
  const eligible: PostRowScheduledFields[] = [];
  const campaignIdsInPool = new Set<string>();

  for (const r of poolRows) {
    campaignIdsInPool.add(r.campaignId);
    if (!isPostedRow(r)) {
      skippedInPool += 1;
      continue;
    }
    if (!isGovernedRow(r)) {
      skippedInPool += 1;
      continue;
    }
    const c = classifyPublishedGovernedPostForBatchRefresh(r);
    if (c.kind !== "eligible") {
      skippedInPool += 1;
      continue;
    }
    eligible.push({ ...r, campaignId: r.campaignId });
  }

  const postIds = eligible.map((p) => p.id);
  const latestRows = await getLatestAnalyticsSnapshotRowsForPostIds(db, postIds);
  const latestFetchedAtByPostId = new Map<string, Date | null>();
  for (const p of eligible) {
    const row = latestRows.get(p.id);
    latestFetchedAtByPostId.set(p.id, row?.fetchedAt ? new Date(row.fetchedAt as Date) : null);
  }

  const ordered = sortEligiblePostsForScheduledRefresh(eligible, latestFetchedAtByPostId);

  const userId = scheduledWorkerUserId();
  let attemptedCount = 0;
  let succeededCount = 0;
  let failedCount = 0;
  let throttledCount = 0;
  let deferredDueToBatchLimit = 0;
  let deferredDueToCampaignLimit = 0;
  let deferredDueToMaxCampaigns = 0;
  let deferredDueToPerProviderCap = 0;
  let deferredDueToProviderBackoff = 0;

  const perCampaign = new Map<string, number>();
  const campaignsWithAttempts = new Set<string>();
  const providerAttempts = new Map<string, number>();
  const perProviderSummary: Record<string, ScheduledRefreshPerProviderMetrics> = {};
  const pausedProviders = new Set<string>();
  const throttleStreak = new Map<string, number>();

  const failureSamples: RunScheduledGovernedPostAnalyticsRefreshSummary["failureSamples"] = [];
  const maxSamples = 12;

  const touchedCampaigns = new Set<string>();

  function bumpProviderSummary(platformKey: string, patch: Partial<ScheduledRefreshPerProviderMetrics>): void {
    const cur = perProviderSummary[platformKey] ?? emptyProviderMetrics();
    perProviderSummary[platformKey] = {
      attempted: cur.attempted + (patch.attempted ?? 0),
      succeeded: cur.succeeded + (patch.succeeded ?? 0),
      failed: cur.failed + (patch.failed ?? 0),
      throttled: cur.throttled + (patch.throttled ?? 0),
    };
  }

  for (const p of ordered) {
    const platformNorm = normalizeCampaignPostPlatformForPublish(p.platform);
    if (!platformNorm) {
      continue;
    }
    const platformKey: SocialPlatform = platformNorm;
    const camp = p.campaignId;

    const isNewCamp = !campaignsWithAttempts.has(camp);
    if (isNewCamp && campaignsWithAttempts.size >= L.maxCampaigns) {
      deferredDueToMaxCampaigns += 1;
      continue;
    }
    const campCnt = perCampaign.get(camp) ?? 0;
    if (campCnt >= L.maxPostsPerCampaign) {
      deferredDueToCampaignLimit += 1;
      continue;
    }
    if (attemptedCount >= L.maxPosts) {
      deferredDueToBatchLimit += 1;
      continue;
    }
    if (pausedProviders.has(platformKey)) {
      deferredDueToProviderBackoff += 1;
      continue;
    }
    const pAttempts = providerAttempts.get(platformKey) ?? 0;
    if (pAttempts >= L.maxPerProvider) {
      deferredDueToPerProviderCap += 1;
      continue;
    }

    attemptedCount += 1;
    perCampaign.set(camp, campCnt + 1);
    campaignsWithAttempts.add(camp);
    providerAttempts.set(platformKey, pAttempts + 1);
    bumpProviderSummary(platformKey, { attempted: 1 });

    const result = await refreshGovernedPostAnalytics({ db, userId, postId: p.id });
    touchedCampaigns.add(camp);

    if (result.ok) {
      succeededCount += 1;
      throttleStreak.set(platformKey, 0);
      bumpProviderSummary(platformKey, { succeeded: 1 });
      continue;
    }

    failedCount += 1;
    const cls = classifyGovernedPostAnalyticsRefreshFailure({
      code: result.code,
      message: result.message,
    });

    if (cls.category === "throttled") {
      throttledCount += 1;
      bumpProviderSummary(platformKey, { throttled: 1 });
    } else {
      bumpProviderSummary(platformKey, { failed: 1 });
    }

    if (failureSamples.length < maxSamples) {
      failureSamples.push({
        postId: p.id,
        code: result.code,
        message: result.message,
        category: cls.category,
      });
    }

    if (cls.signalsProviderThrottleBackoff) {
      const s = (throttleStreak.get(platformKey) ?? 0) + 1;
      throttleStreak.set(platformKey, s);
      if (s >= L.throttlePauseAfter) {
        pausedProviders.add(platformKey);
      }
    } else {
      throttleStreak.set(platformKey, 0);
    }
  }

  const finished = Date.now();
  const finishedIso = new Date(finished).toISOString();

  const summary: RunScheduledGovernedPostAnalyticsRefreshSummary = {
    ok: true,
    scanPoolLimit: L.scanPoolLimit,
    poolScanned: poolRows.length,
    eligibleInPool: eligible.length,
    skippedInPool,
    campaignsInPool: campaignIdsInPool.size,
    campaignsTouched: touchedCampaigns.size,
    attemptedCount,
    succeededCount,
    failedCount,
    throttledCount,
    deferredDueToBatchLimit,
    deferredDueToCampaignLimit,
    deferredDueToMaxCampaigns,
    deferredDueToPerProviderCap,
    deferredDueToProviderBackoff,
    durationMs: finished - started,
    startedAt: startedIso,
    finishedAt: finishedIso,
    maxPostsApplied: L.maxPosts,
    maxPostsPerCampaignApplied: L.maxPostsPerCampaign,
    maxCampaignsApplied: L.maxCampaigns,
    maxPerProviderApplied: L.maxPerProvider,
    throttlePauseAfterApplied: L.throttlePauseAfter,
    perProviderSummary,
    failureSamples,
  };

  await insertGovernedPostAnalyticsScheduledRefreshAudit({
    db,
    userId,
    details: {
      source: "scheduled",
      attemptedCount: summary.attemptedCount,
      succeededCount: summary.succeededCount,
      failedCount: summary.failedCount,
      throttledCount: summary.throttledCount,
      skippedCount: summary.skippedInPool,
      campaignsTouched: summary.campaignsTouched,
      maxCampaigns: L.maxCampaigns,
      maxPosts: L.maxPosts,
      maxPerProvider: L.maxPerProvider,
      throttlePauseAfter: L.throttlePauseAfter,
      scanPoolLimit: L.scanPoolLimit,
      deferredDueToBatchLimit: summary.deferredDueToBatchLimit,
      deferredDueToCampaignLimit: summary.deferredDueToCampaignLimit,
      deferredDueToMaxCampaigns: summary.deferredDueToMaxCampaigns,
      deferredDueToPerProviderCap: summary.deferredDueToPerProviderCap,
      deferredDueToProviderBackoff: summary.deferredDueToProviderBackoff,
      perProviderSummary: summary.perProviderSummary,
      durationMs: summary.durationMs,
    },
  });

  return summary;
}
