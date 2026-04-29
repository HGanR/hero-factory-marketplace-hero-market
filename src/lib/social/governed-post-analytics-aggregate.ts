/**
 * Campaign / provider rollups from the **latest analytics snapshot per post** only (Part 44).
 * No double-counting across historical snapshot rows.
 */

import type { NormalizedSocialPostMetrics } from "@/lib/social/governed-post-analytics-types";
import type { SocialPostTimelineDb } from "@/lib/social/social-post-audit-query";
import { getLatestAnalyticsSnapshotRowsForPostIds, type AnalyticsSnapshotRow } from "@/lib/social/governed-post-analytics-store";
import { parseStoredAnalyticsPayload } from "@/lib/social/governed-post-analytics-normalize";
import { getPlatformMetricSyncSupportState } from "@/lib/social/platform-performance-adapters";
import type { SocialPlatform } from "@/lib/social/config";
import { normalizeCampaignPostPlatformForPublish } from "@/lib/social/platform-identity";
import { defaultSocialAccountLabelForPlatform, isGovernedSocialPublishPlatform } from "@/lib/social/social-governed-platforms";
import { eq } from "drizzle-orm";
import { campaignPosts } from "@/lib/db/schema";

const METRIC_KEYS = [
  "impressions",
  "reach",
  "clicks",
  "reactions",
  "comments",
  "shares",
  "saves",
  "videoViews",
  "engagementsTotal",
] as const satisfies readonly (keyof NormalizedSocialPostMetrics)[];

export type AggregatedMetricRollup = {
  sum: number;
  /** Posts whose latest snapshot included a finite value for this field. */
  posts: number;
};

export type CampaignAnalyticsCoverageCode =
  | "no_governed_posts"
  | "no_published_posts"
  | "published_none_synced"
  | "partial_sync"
  | "all_published_synced"
  | "unsupported_only";

export type CampaignGovernedAnalyticsProviderSummary = {
  provider: SocialPlatform | "unknown";
  displayName: string;
  metricSyncSupport: "live" | "stub_unsupported" | "no_adapter";
  publishedPosts: number;
  postsWithLatestSnapshot: number;
  postsMissingRemotePostId: number;
  /** Metrics summed from latest snapshot per post in this provider bucket. */
  metrics: Partial<Record<keyof NormalizedSocialPostMetrics, AggregatedMetricRollup>>;
};

export type CampaignGovernedAnalyticsFreshness = {
  freshestSnapshotAt: string | null;
  stalestSnapshotAt: string | null;
};

export type CampaignGovernedAnalyticsCoverage = {
  code: CampaignAnalyticsCoverageCode;
  headline: string;
  /** Short operator-facing caveats (partial adapters, comparability). */
  notes: string[];
};

export type CampaignGovernedSocialAnalyticsPayload = {
  campaignId: string;
  campaignSummary: {
    governedPostCount: number;
    publishedPostCount: number;
    postsWithLatestSnapshot: number;
    postsPublishedNeverSynced: number;
    postsMissingRemotePostId: number;
    postsUnsupportedForLiveSync: number;
  };
  aggregateMetrics: Partial<Record<keyof NormalizedSocialPostMetrics, AggregatedMetricRollup>>;
  providerSummaries: CampaignGovernedAnalyticsProviderSummary[];
  coverage: CampaignGovernedAnalyticsCoverage;
  freshness: CampaignGovernedAnalyticsFreshness;
  /** Deployment-wide: which governed providers can call live refresh today. */
  liveAdapterProviders: SocialPlatform[];
};

function iso(d: Date | string | null | undefined): string | null {
  if (d == null) return null;
  if (d instanceof Date) return d.toISOString();
  return String(d);
}

function emptyMetricRollupMap(): Partial<Record<keyof NormalizedSocialPostMetrics, AggregatedMetricRollup>> {
  return {};
}

function addMetric(
  target: Partial<Record<keyof NormalizedSocialPostMetrics, AggregatedMetricRollup>>,
  key: keyof NormalizedSocialPostMetrics,
  value: number
): void {
  if (!Number.isFinite(value)) return;
  const cur = target[key];
  if (!cur) {
    target[key] = { sum: value, posts: 1 };
    return;
  }
  cur.sum += value;
  cur.posts += 1;
}

function mergeRollupMaps(
  a: Partial<Record<keyof NormalizedSocialPostMetrics, AggregatedMetricRollup>>,
  b: Partial<Record<keyof NormalizedSocialPostMetrics, AggregatedMetricRollup>>
): void {
  for (const k of METRIC_KEYS) {
    const part = b[k];
    if (!part) continue;
    const cur = a[k];
    if (!cur) {
      a[k] = { sum: part.sum, posts: part.posts };
    } else {
      cur.sum += part.sum;
      cur.posts += part.posts;
    }
  }
}

function rollupFromNormalized(n: NormalizedSocialPostMetrics): Partial<Record<keyof NormalizedSocialPostMetrics, AggregatedMetricRollup>> {
  const out = emptyMetricRollupMap();
  for (const k of METRIC_KEYS) {
    const v = n[k];
    if (typeof v === "number" && Number.isFinite(v)) {
      addMetric(out, k, v);
    }
  }
  return out;
}

type PostLite = {
  id: string;
  status: string | null;
  platform: string | null;
  platformPostId: string | null;
};

function isPosted(st: string | null | undefined): boolean {
  return String(st || "").toUpperCase() === "POSTED";
}

/**
 * Pure rollup for tests and reuse — latest snapshot map must already be “one row per post” (newest `fetched_at`).
 */
export function computeCampaignGovernedSocialAnalyticsRollup(args: {
  posts: PostLite[];
  latestSnapshotByPostId: Map<string, Pick<AnalyticsSnapshotRow, "fetchedAt" | "metricsJson">>;
}): Omit<CampaignGovernedSocialAnalyticsPayload, "campaignId" | "liveAdapterProviders"> {
  const governed = args.posts.filter((p) => {
    const key = normalizeCampaignPostPlatformForPublish(p.platform);
    return key && isGovernedSocialPublishPlatform(key);
  });

  const published = governed.filter((p) => isPosted(p.status));

  const providerBuckets = new Map<
    SocialPlatform | "unknown",
    {
      publishedPosts: number;
      postsWithLatestSnapshot: number;
      postsMissingRemotePostId: number;
      metrics: Partial<Record<keyof NormalizedSocialPostMetrics, AggregatedMetricRollup>>;
      metricSyncSupport: "live" | "stub_unsupported" | "no_adapter";
    }
  >();

  function ensureBucket(key: SocialPlatform | "unknown", support: "live" | "stub_unsupported" | "no_adapter") {
    let b = providerBuckets.get(key);
    if (!b) {
      b = {
        publishedPosts: 0,
        postsWithLatestSnapshot: 0,
        postsMissingRemotePostId: 0,
        metrics: emptyMetricRollupMap(),
        metricSyncSupport: support,
      };
      providerBuckets.set(key, b);
    }
    return b;
  }

  let postsWithLatestSnapshot = 0;
  let postsPublishedNeverSynced = 0;
  let postsMissingRemotePostId = 0;
  let postsUnsupportedForLiveSync = 0;

  const aggregateMetrics = emptyMetricRollupMap();
  const fetchedTimes: number[] = [];

  for (const p of published) {
    const platformKey = normalizeCampaignPostPlatformForPublish(p.platform);
    const bucketKey: SocialPlatform | "unknown" = platformKey ?? "unknown";
    const support =
      platformKey && isGovernedSocialPublishPlatform(platformKey)
        ? getPlatformMetricSyncSupportState(platformKey)
        : "no_adapter";

    const b = ensureBucket(bucketKey, support);
    b.publishedPosts += 1;

    if (support !== "live") {
      postsUnsupportedForLiveSync += 1;
    }

    const ext = p.platformPostId?.trim();
    if (!ext) {
      postsMissingRemotePostId += 1;
      b.postsMissingRemotePostId += 1;
    }

    const row = args.latestSnapshotByPostId.get(p.id);
    const parsed = row ? parseStoredAnalyticsPayload(row.metricsJson) : null;

    if (row && parsed) {
      postsWithLatestSnapshot += 1;
      b.postsWithLatestSnapshot += 1;
      const roll = rollupFromNormalized(parsed.normalized);
      mergeRollupMaps(aggregateMetrics, roll);
      mergeRollupMaps(b.metrics, roll);
      const t = Date.parse(iso(row.fetchedAt) ?? "");
      if (Number.isFinite(t)) fetchedTimes.push(t);
    } else if (support === "live" && ext) {
      postsPublishedNeverSynced += 1;
    }
  }

  const providerSummaries: CampaignGovernedAnalyticsProviderSummary[] = [];
  const order: (SocialPlatform | "unknown")[] = ["linkedin", "instagram", "facebook", "unknown"];
  for (const prov of order) {
    const b = providerBuckets.get(prov);
    if (!b || b.publishedPosts === 0) continue;
    providerSummaries.push({
      provider: prov,
      displayName: prov === "unknown" ? "Unknown / other" : defaultSocialAccountLabelForPlatform(prov),
      metricSyncSupport: b.metricSyncSupport,
      publishedPosts: b.publishedPosts,
      postsWithLatestSnapshot: b.postsWithLatestSnapshot,
      postsMissingRemotePostId: b.postsMissingRemotePostId,
      metrics: b.metrics,
    });
  }

  let code: CampaignAnalyticsCoverageCode = "partial_sync";
  const notes: string[] = [
    "Totals sum the latest stored snapshot per published post. Provider definitions differ — do not treat sums as apples-to-apples across networks.",
  ];

  if (governed.length === 0) {
    code = "no_governed_posts";
  } else if (published.length === 0) {
    code = "no_published_posts";
  } else if (postsWithLatestSnapshot === 0) {
    code = published.every((p) => {
      const k = normalizeCampaignPostPlatformForPublish(p.platform);
      const sup = k && isGovernedSocialPublishPlatform(k) ? getPlatformMetricSyncSupportState(k) : "no_adapter";
      return sup !== "live";
    })
      ? "unsupported_only"
      : "published_none_synced";
  } else if (postsWithLatestSnapshot === published.length) {
    code = "all_published_synced";
  }

  if (providerSummaries.some((s) => s.provider === "facebook" && s.metricSyncSupport === "no_adapter")) {
    notes.push("Facebook: no live metrics adapter in this deployment — snapshots only if stored another way.");
  }
  if (providerSummaries.some((s) => s.metricSyncSupport === "stub_unsupported")) {
    notes.push("Some providers are stub-declared; live refresh may not return new data.");
  }

  const headlines: Record<CampaignAnalyticsCoverageCode, string> = {
    no_governed_posts: "No governed social posts in this campaign.",
    no_published_posts: "No published governed posts yet — analytics roll up after publish.",
    published_none_synced: "Published posts have no stored metrics yet (or adapters are unavailable).",
    partial_sync: "Some published posts are missing a latest snapshot — coverage is partial.",
    all_published_synced: "Every published governed post has at least one stored snapshot (latest row used).",
    unsupported_only: "Published posts use providers without live metric sync in this deployment.",
  };

  const freshness: CampaignGovernedAnalyticsFreshness = {
    freshestSnapshotAt:
      fetchedTimes.length > 0 ? new Date(Math.max(...fetchedTimes)).toISOString() : null,
    stalestSnapshotAt:
      fetchedTimes.length > 0 ? new Date(Math.min(...fetchedTimes)).toISOString() : null,
  };

  return {
    campaignSummary: {
      governedPostCount: governed.length,
      publishedPostCount: published.length,
      postsWithLatestSnapshot,
      postsPublishedNeverSynced,
      postsMissingRemotePostId,
      postsUnsupportedForLiveSync,
    },
    aggregateMetrics,
    providerSummaries,
    coverage: { code, headline: headlines[code], notes },
    freshness,
  };
}

function liveGovernedPlatforms(): SocialPlatform[] {
  const out: SocialPlatform[] = [];
  for (const p of ["linkedin", "facebook", "instagram"] as const) {
    if (getPlatformMetricSyncSupportState(p) === "live") out.push(p);
  }
  return out;
}

/**
 * Load governed `campaign_posts` for the campaign and build rollup from latest snapshot per published post.
 */
export async function buildCampaignGovernedSocialAnalyticsAggregate(
  db: SocialPostTimelineDb,
  campaignId: string
): Promise<CampaignGovernedSocialAnalyticsPayload> {
  const rows = await db
    .select({
      id: campaignPosts.id,
      status: campaignPosts.status,
      platform: campaignPosts.platform,
      platformPostId: campaignPosts.platformPostId,
    })
    .from(campaignPosts)
    .where(eq(campaignPosts.campaignId, campaignId));

  const postsLite: PostLite[] = rows.filter((r) => {
    const k = normalizeCampaignPostPlatformForPublish(r.platform);
    return k && isGovernedSocialPublishPlatform(k);
  });

  const publishedIds = postsLite.filter((p) => isPosted(p.status)).map((p) => p.id);
  const latestMap = await getLatestAnalyticsSnapshotRowsForPostIds(db, publishedIds);
  const slim = new Map<string, Pick<AnalyticsSnapshotRow, "fetchedAt" | "metricsJson">>();
  for (const [id, row] of latestMap) {
    slim.set(id, { fetchedAt: row.fetchedAt, metricsJson: row.metricsJson });
  }

  const rollup = computeCampaignGovernedSocialAnalyticsRollup({
    posts: postsLite,
    latestSnapshotByPostId: slim,
  });

  return {
    campaignId,
    ...rollup,
    liveAdapterProviders: liveGovernedPlatforms(),
  };
}
