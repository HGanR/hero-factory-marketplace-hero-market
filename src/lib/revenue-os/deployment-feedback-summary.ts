/**
 * Pure rollups over normalized deployment feedback rows.
 */

import type {
  DeploymentFeedbackRowKind,
  NormalizedDeploymentFeedback,
} from "@/lib/revenue-os/deployment-feedback-contract";
import {
  summarizeComparablePlatformPerformance,
  type ComparableConfidence,
} from "@/lib/revenue-os/cross-platform-performance-normalization";
import {
  buildDefaultMetricSyncContext,
  getPlatformEvidenceQuality,
  getPlatformEvidenceWeight,
  type MetricSyncContextLike,
} from "@/lib/revenue-os/platform-evidence-weighting";

export type AttentionSignalStrength = "none" | "light" | "promising" | "strong";

export type DeploymentFeedbackRollup = {
  publishedCount: number;
  failedCount: number;
  retryCount: number;
  latestPublishedAt: string | null;
  /** Strongest platform by **measured** rows on channels with live metric sync (e.g. Instagram, LinkedIn). */
  bestMeasuredPlatform?: string;
  /** Most successful publishes by volume (not a performance ranking when metrics are missing). */
  bestPublishedPlatform?: string;
  /** Legacy: `bestMeasuredPlatform ?? bestPublishedPlatform` for backward-compatible consumers. */
  bestPlatform?: string;
  weakestMeasuredPlatform?: string;
  weakestPublishedPlatform?: string;
  weakestPlatform?: string;
  hasPerformanceMetrics: boolean;
  highestImpressionPost?: { campaignPostId: string; platform: string; impressions: number };
  highestEngagementPost?: { campaignPostId: string; platform: string; engagementScore: number };
  latestMetricSyncedAt: string | null;
  attentionSignalStrength: AttentionSignalStrength;
  recommendationHints: string[];
  /** Strongest measured attention (impressions) among live-metric rows — not the same as engagement leader. */
  bestAttentionPlatform?: string;
  /** Strongest engagement-style signal (excludes impression mass) among live-metric rows. */
  bestEngagementPlatform?: string;
  /** How safe it is to compare channels in this rollup (never treats LI actions as IG reach). */
  comparisonConfidence?: ComparableConfidence;
  /** Pre-written safe lines for Bentley / UI (directional framing). */
  crossPlatformNarrativeLines?: string[];
  /** Observability: metric classes and strengths per platform (use in debug UI). */
  crossPlatformComparableDebug?: {
    perPlatform: Record<
      string,
      { attentionStrength: number; engagementStrength: number; metricClasses: string[] }
    >;
    primaryComparisonBasis: "attention" | "engagement" | "mixed" | "none";
    confidenceNotes: string[];
    measuredLivePlatformsInComparison: string[];
  };
};

export type SummarizeDeploymentFeedbackOptions = {
  metricSyncContext?: MetricSyncContextLike | null;
};

export function feedbackRowKind(f: NormalizedDeploymentFeedback): DeploymentFeedbackRowKind {
  return f.feedbackRowKind === "performance_metrics" ? "performance_metrics" : "publish_outcome";
}

function hasAnyMetrics(f: NormalizedDeploymentFeedback): boolean {
  return (
    f.impressions != null ||
    f.clicks != null ||
    f.engagement != null ||
    f.comments != null ||
    f.shares != null ||
    f.saves != null ||
    f.leads != null ||
    f.ctr != null ||
    f.cpc != null
  );
}

/** Latest performance_metrics row per post (by syncedAt then recordedAt). */
export function mergeLatestMetricSnapshotsByPost(
  feedbackRows: NormalizedDeploymentFeedback[]
): Map<string, NormalizedDeploymentFeedback> {
  const m = new Map<string, NormalizedDeploymentFeedback>();
  for (const r of feedbackRows) {
    if (feedbackRowKind(r) !== "performance_metrics") continue;
    const prev = m.get(r.campaignPostId);
    const t = (r.syncedAt || r.recordedAt || "").trim();
    const pt = prev ? (prev.syncedAt || prev.recordedAt || "").trim() : "";
    if (!prev || t > pt) m.set(r.campaignPostId, r);
  }
  return m;
}

/**
 * Rows to use for impressions/clicks/engagement rollups (dedupes metrics per post).
 */
export function rowsForMetricAggregation(feedbackRows: NormalizedDeploymentFeedback[]): NormalizedDeploymentFeedback[] {
  const latest = mergeLatestMetricSnapshotsByPost(feedbackRows);
  const withMetricPosts = new Set(latest.keys());
  const fromOutcomes = feedbackRows.filter(
    (r) =>
      feedbackRowKind(r) === "publish_outcome" &&
      r.publishStatus === "published" &&
      hasAnyMetrics(r) &&
      !withMetricPosts.has(r.campaignPostId)
  );
  return [...Array.from(latest.values()), ...fromOutcomes];
}

/** Simple engagement proxy when platforms report different shapes. */
export function metricScore(f: NormalizedDeploymentFeedback): number {
  let s = 0;
  if (f.engagement != null) s += f.engagement;
  if (f.clicks != null) s += f.clicks * 2;
  if (f.impressions != null) s += f.impressions * 0.01;
  if (f.comments != null) s += f.comments * 3;
  if (f.shares != null) s += f.shares * 4;
  if (f.saves != null) s += f.saves * 3;
  if (f.leads != null) s += f.leads * 20;
  return s;
}

function computeAttentionStrength(
  metricRows: NormalizedDeploymentFeedback[],
  ctx: MetricSyncContextLike
): AttentionSignalStrength {
  if (metricRows.length === 0) return "none";
  let maxImp = 0;
  let maxScore = 0;
  for (const r of metricRows) {
    if (!hasAnyMetrics(r)) continue;
    const w = getPlatformEvidenceWeight(r.platform, ctx);
    if (r.impressions != null) maxImp = Math.max(maxImp, r.impressions * w);
    maxScore = Math.max(maxScore, metricScore(r) * w);
  }
  if (maxImp <= 0 && maxScore <= 0) return "none";
  if (maxImp < 800 && maxScore < 12) return "light";
  if (maxImp < 8000 && maxScore < 45) return "promising";
  return "strong";
}

export function summarizeDeploymentFeedback(
  feedbackRows: NormalizedDeploymentFeedback[],
  options?: SummarizeDeploymentFeedbackOptions
): DeploymentFeedbackRollup {
  const ctx = options?.metricSyncContext ?? buildDefaultMetricSyncContext();
  const liveMetricChannelLabels = ctx.liveMetricPlatforms.map(
    (p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()
  );
  const liveMetricListPretty =
    liveMetricChannelLabels.length === 0
      ? "live-synced channels"
      : liveMetricChannelLabels.length === 1
        ? liveMetricChannelLabels[0]!
        : `${liveMetricChannelLabels.slice(0, -1).join(", ")} and ${liveMetricChannelLabels[liveMetricChannelLabels.length - 1]}`;
  const outcomeRows = feedbackRows.filter((f) => feedbackRowKind(f) === "publish_outcome");
  const metricRows = rowsForMetricAggregation(feedbackRows);
  const hasPerformanceMetrics = metricRows.some(hasAnyMetrics);

  let publishedCount = 0;
  let failedCount = 0;
  let retryCount = 0;
  let latestPublishedAt: string | null = null;

  for (const f of outcomeRows) {
    if (f.publishStatus === "published") {
      publishedCount += 1;
      if (f.publishedAt) {
        if (!latestPublishedAt || f.publishedAt > latestPublishedAt) latestPublishedAt = f.publishedAt;
      }
    } else if (f.publishStatus === "failed") {
      failedCount += 1;
    } else if (f.publishStatus === "retry_scheduled") {
      retryCount += 1;
    }
  }

  const pubBy: Record<string, number> = {};
  const failBy: Record<string, number> = {};
  for (const f of outcomeRows) {
    const p = f.platform.toLowerCase();
    if (f.publishStatus === "published") pubBy[p] = (pubBy[p] ?? 0) + 1;
    if (f.publishStatus === "failed") failBy[p] = (failBy[p] ?? 0) + 1;
  }

  const byPlatform = summarizeDeploymentFeedbackByPlatform(feedbackRows);
  const metricPlatforms = Object.keys(byPlatform);

  const measuredWeighted: Record<string, number> = {};
  for (const r of metricRows) {
    if (!hasAnyMetrics(r)) continue;
    if (getPlatformEvidenceQuality(r.platform, ctx) !== "live_metrics") continue;
    const p = r.platform.toLowerCase();
    measuredWeighted[p] = (measuredWeighted[p] ?? 0) + metricScore(r) * getPlatformEvidenceWeight(r.platform, ctx);
  }
  const measuredPlats = Object.keys(measuredWeighted);
  let bestMeasuredPlatform: string | undefined;
  let weakestMeasuredPlatform: string | undefined;
  if (measuredPlats.length >= 2) {
    const ranked = measuredPlats.sort((a, b) => measuredWeighted[b]! - measuredWeighted[a]!);
    bestMeasuredPlatform = ranked[0];
    weakestMeasuredPlatform = ranked[ranked.length - 1];
  } else if (measuredPlats.length === 1) {
    bestMeasuredPlatform = measuredPlats[0];
  }

  const pubPlats = Object.keys(pubBy);
  const bestPublishedPlatform =
    pubPlats.length > 0 ? pubPlats.sort((a, b) => pubBy[b]! - pubBy[a]!)[0] : undefined;

  const failPlats = Object.keys(failBy);
  const weakestPublishedPlatform =
    failPlats.length > 0 ? failPlats.sort((a, b) => failBy[b]! - failBy[a]!)[0] : undefined;

  /** Publish-only / non-live metric rollup (does not imply “performance winner” for live channels). */
  let bestPlatformFromNonLiveMetrics: string | undefined;
  let weakestPlatformFromNonLiveMetrics: string | undefined;
  const nonLiveWeighted: Record<string, number> = {};
  for (const r of metricRows) {
    if (!hasAnyMetrics(r)) continue;
    if (getPlatformEvidenceQuality(r.platform, ctx) === "live_metrics") continue;
    const p = r.platform.toLowerCase();
    nonLiveWeighted[p] = (nonLiveWeighted[p] ?? 0) + metricScore(r) * getPlatformEvidenceWeight(r.platform, ctx);
  }
  const nonLivePlats = Object.keys(nonLiveWeighted);
  if (nonLivePlats.length >= 2) {
    const ranked = nonLivePlats.sort((a, b) => nonLiveWeighted[b]! - nonLiveWeighted[a]!);
    bestPlatformFromNonLiveMetrics = ranked[0];
    weakestPlatformFromNonLiveMetrics = ranked[ranked.length - 1];
  } else if (nonLivePlats.length === 1) {
    bestPlatformFromNonLiveMetrics = nonLivePlats[0];
  }

  let bestPlatform = bestMeasuredPlatform ?? bestPublishedPlatform;
  if (!bestPlatform && metricPlatforms.length) {
    const ranked = metricPlatforms.sort((a, b) => byPlatform[b]! - byPlatform[a]!);
    bestPlatform = ranked[0];
  }

  let weakestPlatform = weakestMeasuredPlatform ?? weakestPublishedPlatform;
  if (!weakestPlatform && nonLivePlats.length >= 2) {
    weakestPlatform = weakestPlatformFromNonLiveMetrics;
  }
  if (!weakestPlatform && metricPlatforms.length >= 2) {
    const ranked = metricPlatforms.sort((a, b) => byPlatform[b]! - byPlatform[a]!);
    weakestPlatform = ranked[ranked.length - 1];
  }

  let highestImpressionPost: DeploymentFeedbackRollup["highestImpressionPost"];
  let highestEngagementPost: DeploymentFeedbackRollup["highestEngagementPost"];
  let latestMetricSyncedAt: string | null = null;

  for (const r of metricRows) {
    if (!hasAnyMetrics(r)) continue;
    const imp = r.impressions ?? 0;
    if (r.impressions != null) {
      if (!highestImpressionPost || imp > highestImpressionPost.impressions) {
        highestImpressionPost = {
          campaignPostId: r.campaignPostId,
          platform: r.platform,
          impressions: r.impressions,
        };
      }
    }
    const sc = metricScore(r);
    if (sc > 0) {
      if (!highestEngagementPost || sc > highestEngagementPost.engagementScore) {
        highestEngagementPost = {
          campaignPostId: r.campaignPostId,
          platform: r.platform,
          engagementScore: Math.round(sc * 10) / 10,
        };
      }
    }
    const syncT = (r.syncedAt || r.recordedAt || "").trim();
    if (syncT && (!latestMetricSyncedAt || syncT > latestMetricSyncedAt)) {
      latestMetricSyncedAt = syncT;
    }
  }

  const attentionSignalStrength = computeAttentionStrength(metricRows, ctx);

  const comparableRows = metricRows.map((r) => ({
    platform: r.platform,
    impressions: r.impressions,
    clicks: r.clicks,
    engagement: r.engagement,
    comments: r.comments,
    shares: r.shares,
    saves: r.saves,
    leads: r.leads,
    evidenceQuality: getPlatformEvidenceQuality(r.platform, ctx),
    feedbackRowKind: feedbackRowKind(r),
  }));
  const comparableSummary = summarizeComparablePlatformPerformance({
    metricRows: comparableRows,
    ctx,
  });

  const hints: string[] = [];
  hints.push(...comparableSummary.safeNarrativeLines.slice(0, 3));

  const splitAttEngLeaders = Boolean(
    comparableSummary.bestAttentionPlatform &&
      comparableSummary.bestEngagementPlatform &&
      comparableSummary.bestAttentionPlatform !== comparableSummary.bestEngagementPlatform
  );

  if (
    hasPerformanceMetrics &&
    bestMeasuredPlatform &&
    weakestMeasuredPlatform &&
    bestMeasuredPlatform !== weakestMeasuredPlatform &&
    !splitAttEngLeaders
  ) {
    hints.push(
      `**Best measured** channel (live metric sync, legacy composite score): **${bestMeasuredPlatform}**; **${weakestMeasuredPlatform}** is softer on measured data — test hooks there.`
    );
  } else if (
    hasPerformanceMetrics &&
    bestMeasuredPlatform &&
    weakestMeasuredPlatform &&
    bestMeasuredPlatform !== weakestMeasuredPlatform &&
    splitAttEngLeaders
  ) {
    hints.push(
      `**Softer on measured composite:** **${weakestMeasuredPlatform}** — attention vs engagement leaders differ by channel here; test hooks there without claiming one network “beat” another on unlike metrics.`
    );
  } else if (
    hasPerformanceMetrics &&
    bestMeasuredPlatform &&
    attentionSignalStrength !== "none" &&
    comparableSummary.bestAttentionPlatform === comparableSummary.bestEngagementPlatform
  ) {
    hints.push(
      `**${bestMeasuredPlatform}** leads on **measured** composite score — attention and engagement leaders align in this rollup; still treat cross-network reads as directional.`
    );
  } else if (hasPerformanceMetrics && bestPlatformFromNonLiveMetrics && !bestMeasuredPlatform) {
    hints.push(
      `**${bestPlatformFromNonLiveMetrics}** shows the strongest **synced numbers among non–live-metric channels** — not equivalent to **${liveMetricListPretty}** (live API sync); interpret cautiously.`
    );
  }

  if (bestPublishedPlatform && (!bestMeasuredPlatform || bestPublishedPlatform !== bestMeasuredPlatform)) {
    hints.push(
      `**Most published (operational):** **${bestPublishedPlatform}** — this is delivery volume, not proof of creative performance unless metrics say so.`
    );
  }

  if (hasPerformanceMetrics && !bestMeasuredPlatform && ctx.liveMetricPlatforms.length > 0) {
    hints.push(
      `No **measured-platform** metrics in this scope yet — run performance sync for **${liveMetricListPretty}** (or wait for data) before claiming a measured winner.`
    );
  }

  if (failedCount > publishedCount && publishedCount + failedCount >= 3) {
    hints.push("Failures outnumber successful publishes — fix OAuth, assets, and platform policies before scaling volume.");
  }
  if (retryCount >= 2) {
    hints.push("Several posts hit retries — watch scheduled worker logs and token health.");
  }

  if (publishedCount >= 1 && !hasPerformanceMetrics) {
    hints.push("Publish outcomes are tracked; run the **platform performance sync** job when connectors are enabled for impressions/clicks in-loop.");
  }
  if (publishedCount === 0 && failedCount === 0) {
    hints.push("No deployment feedback yet — publish or schedule posts to close the loop.");
  }

  if (hasPerformanceMetrics) {
    if (attentionSignalStrength === "light") {
      hints.push("Early signals are light — keep posting volume steady and wait for more data before big creative pivots.");
    }
    const anyClicks = metricRows.some((r) => r.clicks != null && r.clicks > 0);
    const anyImp = metricRows.some((r) => r.impressions != null && r.impressions > 0);
    if (anyImp && !anyClicks) {
      hints.push("Impressions without clicks suggest CTA/hook or offer-market fit needs tuning — not a revenue conclusion yet.");
    }
    const anyLeads = metricRows.some((r) => r.leads != null && r.leads > 0);
    if (!anyLeads) {
      hints.push("No lead counts in sync data — capital/ROI reads stay conservative until conversion signals arrive.");
    }
  }

  return {
    publishedCount,
    failedCount,
    retryCount,
    latestPublishedAt,
    bestMeasuredPlatform,
    bestPublishedPlatform,
    bestPlatform,
    weakestMeasuredPlatform,
    weakestPublishedPlatform,
    weakestPlatform,
    hasPerformanceMetrics,
    highestImpressionPost,
    highestEngagementPost,
    latestMetricSyncedAt,
    attentionSignalStrength,
    recommendationHints: hints.slice(0, 14),
    bestAttentionPlatform: comparableSummary.bestAttentionPlatform,
    bestEngagementPlatform: comparableSummary.bestEngagementPlatform,
    comparisonConfidence: comparableSummary.comparisonConfidence,
    crossPlatformNarrativeLines: comparableSummary.safeNarrativeLines,
    crossPlatformComparableDebug: {
      perPlatform: comparableSummary.perPlatform,
      primaryComparisonBasis: comparableSummary.primaryComparisonBasis,
      confidenceNotes: comparableSummary.confidenceNotes,
      measuredLivePlatformsInComparison: comparableSummary.measuredLivePlatformsInComparison,
    },
  };
}

/** Aggregate metric score per platform (deduped metric rows). */
export function summarizeDeploymentFeedbackByPlatform(
  feedbackRows: NormalizedDeploymentFeedback[]
): Record<string, number> {
  const acc: Record<string, number> = {};
  for (const f of rowsForMetricAggregation(feedbackRows)) {
    if (!hasAnyMetrics(f)) continue;
    const p = f.platform.toLowerCase();
    acc[p] = (acc[p] ?? 0) + metricScore(f);
  }
  return acc;
}

export function coarseEngagementTotal(feedbackRows: NormalizedDeploymentFeedback[]): number {
  let t = 0;
  for (const f of rowsForMetricAggregation(feedbackRows)) {
    t += metricScore(f);
  }
  return t;
}

/** Split metric rollup totals by live-metrics vs publish-only / unsupported tiers (for signal enrichment). */
export type CoarseEngagementSplitForSignals = {
  measuredTotal: number;
  publishOnlyTotal: number;
  /** Distinct posts (deduped metric rows) with any metrics on `live_metrics` platforms. */
  measuredMetricPostCount: number;
};

export function coarseEngagementSplitForSignals(
  feedbackRows: NormalizedDeploymentFeedback[],
  metricSyncContext?: MetricSyncContextLike | null
): CoarseEngagementSplitForSignals {
  const ctx = metricSyncContext ?? buildDefaultMetricSyncContext();
  const measuredPosts = new Set<string>();
  let measuredTotal = 0;
  let publishOnlyTotal = 0;
  for (const f of rowsForMetricAggregation(feedbackRows)) {
    if (!hasAnyMetrics(f)) continue;
    const sc = metricScore(f);
    if (getPlatformEvidenceQuality(f.platform, ctx) === "live_metrics") {
      measuredTotal += sc;
      measuredPosts.add(f.campaignPostId);
    } else {
      publishOnlyTotal += sc;
    }
  }
  return {
    measuredTotal,
    publishOnlyTotal,
    measuredMetricPostCount: measuredPosts.size,
  };
}

export function totalLeadsReported(feedbackRows: NormalizedDeploymentFeedback[]): number {
  let n = 0;
  for (const f of rowsForMetricAggregation(feedbackRows)) {
    if (f.leads != null) n += f.leads;
  }
  return n;
}
