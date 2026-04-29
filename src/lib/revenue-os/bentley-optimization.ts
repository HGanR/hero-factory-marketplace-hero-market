/**
 * Bentley closed-loop optimization — deterministic diagnosis from real Revenue OS signals.
 *
 * Signal sources (see docs/internal/bentley-optimization-signals-audit.md):
 * - Governed social rollup: `buildCampaignGovernedSocialAnalyticsAggregate` / `CampaignGovernedSocialAnalyticsPayload`
 * - Post status counts from `campaign_posts`
 * - Optional publish-approval aggregates from `computePublishApprovalAnalytics`
 * - Optional workspace monthly snapshots: `revenue_os_monthly_snapshots` (business funnel — not post-level)
 */

import type { CampaignGovernedSocialAnalyticsPayload } from "@/lib/social/governed-post-analytics-aggregate";
import type { NormalizedSocialPostMetrics } from "@/lib/social/governed-post-analytics-types";

export type BentleyOptimizationPrimaryDriver =
  | "traffic"
  | "conversion"
  | "aov"
  | "engagement"
  | "publish_friction"
  | "approval_friction"
  | "unknown";

export type BentleyOptimizationConfidence = "low" | "medium" | "high";

export type BentleyOptimizationStatus = "ready" | "insufficient_data" | "blocked";

export type BentleyOptimizationFinding = {
  code: string;
  detail: string;
};

export type BentleyOptimizationRecommendation = {
  kind: "content" | "operational" | "scheduling" | "platform_mix" | "measurement";
  text: string;
};

export type BentleyVariantOpportunity = {
  kind: "hook" | "cta" | "platform_mix" | "schedule" | "offer_clarity";
  label: string;
  rationale: string;
};

export type BentleyOptimizationResult = {
  status: BentleyOptimizationStatus;
  primaryDriver: BentleyOptimizationPrimaryDriver;
  findings: BentleyOptimizationFinding[];
  recommendations: BentleyOptimizationRecommendation[];
  variantOpportunities: BentleyVariantOpportunity[];
  confidence: BentleyOptimizationConfidence;
  /** Structured hints for persistence / UI; all numeric thresholds are explicit here. */
  metricsEcho: {
    publishedPostCount: number;
    postsWithLatestSnapshot: number;
    aggregateImpressionsSum: number | null;
    aggregateClicksSum: number | null;
    engagementNumerator: number | null;
    failedPostCount: number;
    pendingApprovalCount: number | null;
    overdueApprovalCount: number | null;
    coverageCode: string;
  };
};

export type BentleyOptimizationPostCounts = {
  /** Counts for governed posts only (same scope as aggregate when passed from runner). */
  failed: number;
  scheduledOrDraft: number;
  posted: number;
};

export type BentleyOptimizationApprovalSummary = {
  pendingApprovalCount: number;
  overdueApprovalCount: number;
};

export type BentleyOptimizationMonthlyHint = {
  /** Optional funnel hint from `revenue_os_monthly_snapshots` or analysis form — not causal with a single post. */
  conversionRatePct?: number;
  avgOrderValue?: number;
  traffic?: number;
};

export type BentleyOptimizationPriorHints = {
  /** Primary drivers where a prior child variant underperformed vs parent (comparison / score). */
  losingPrimaryDrivers: BentleyOptimizationPrimaryDriver[];
  /** Drivers that previously produced winning variants — deprioritize repeating the exact same angle. */
  winningPrimaryDrivers: BentleyOptimizationPrimaryDriver[];
};

export type BentleyOptimizationInput = {
  aggregate: CampaignGovernedSocialAnalyticsPayload;
  postCounts: BentleyOptimizationPostCounts;
  approval?: BentleyOptimizationApprovalSummary | null;
  monthly?: BentleyOptimizationMonthlyHint | null;
  /** Optional feedback from past runs on the same campaign (same `campaign_id`). */
  priorHints?: BentleyOptimizationPriorHints | null;
};

/** Minimum published posts with at least one synced snapshot before we claim medium+ confidence on engagement/traffic. */
export const BENTLEY_OPT_MIN_PUBLISHED_SYNCED_FOR_ENGAGEMENT = 2;

/** Minimum sum of impressions (when known) to diagnose “low traffic” vs “insufficient reach”. */
export const BENTLEY_OPT_MIN_IMPRESSIONS_FOR_TRAFFIC_DIAGNOSIS = 400;

/** Below this engagement ratio (weak signal), flag engagement when impressions exist. */
export const BENTLEY_OPT_ENGAGEMENT_RATIO_WEAK = 0.02;

function metricSum(
  m: Partial<Record<keyof NormalizedSocialPostMetrics, { sum: number; posts: number }>>,
  key: keyof NormalizedSocialPostMetrics
): number | null {
  const v = m[key];
  if (!v || !Number.isFinite(v.sum)) return null;
  return v.sum;
}

function engagementNumeratorFromAggregate(
  aggregateMetrics: CampaignGovernedSocialAnalyticsPayload["aggregateMetrics"]
): number | null {
  const keys: (keyof NormalizedSocialPostMetrics)[] = ["reactions", "comments", "shares", "saves"];
  let n = 0;
  let any = false;
  for (const k of keys) {
    const v = metricSum(aggregateMetrics, k);
    if (v != null) {
      any = true;
      n += v;
    }
  }
  return any ? n : null;
}

/**
 * Deterministic diagnosis from pre-loaded analytics bundle (no I/O).
 */
export function runBentleyOptimizationDiagnosis(input: BentleyOptimizationInput): BentleyOptimizationResult {
  const { aggregate, postCounts, approval, monthly, priorHints } = input;
  const s = aggregate.campaignSummary;
  const cov = aggregate.coverage.code;
  const impressions = metricSum(aggregate.aggregateMetrics, "impressions");
  const reach = metricSum(aggregate.aggregateMetrics, "reach");
  const impressionsOrReach = impressions ?? reach;
  const clicks = metricSum(aggregate.aggregateMetrics, "clicks");
  const engN = engagementNumeratorFromAggregate(aggregate.aggregateMetrics);

  const findings: BentleyOptimizationFinding[] = [];
  const recommendations: BentleyOptimizationRecommendation[] = [];
  const variantOpportunities: BentleyVariantOpportunity[] = [];

  const metricsEcho = {
    publishedPostCount: s.publishedPostCount,
    postsWithLatestSnapshot: s.postsWithLatestSnapshot,
    aggregateImpressionsSum: impressions,
    aggregateClicksSum: clicks,
    engagementNumerator: engN,
    failedPostCount: postCounts.failed,
    pendingApprovalCount: approval?.pendingApprovalCount ?? null,
    overdueApprovalCount: approval?.overdueApprovalCount ?? null,
    coverageCode: cov,
  };

  if (postCounts.failed > 0) {
    findings.push({
      code: "publish_failures_present",
      detail: `${postCounts.failed} governed post(s) are in FAILED status — fix platform/account issues before optimizing copy.`,
    });
    recommendations.push({
      kind: "operational",
      text: "Review failed posts in the publishing planner: reconnect OAuth, fix captions that violate policy, or retry publish after resolving the error message on each post.",
    });
  }

  if (approval && approval.overdueApprovalCount > 0) {
    findings.push({
      code: "approval_overdue",
      detail: `${approval.overdueApprovalCount} post(s) are past the approval SLA — throughput is blocked by governance, not creative quality.`,
    });
    recommendations.push({
      kind: "operational",
      text: "Reduce approval friction: assign reviewers, shorten the chain, or batch approvals — see publish-approval analytics for stalled posts.",
    });
  } else if (approval && approval.pendingApprovalCount >= 3) {
    findings.push({
      code: "approval_backlog",
      detail: `${approval.pendingApprovalCount} post(s) awaiting approval — content cannot perform until published.`,
    });
    recommendations.push({
      kind: "operational",
      text: "Clear the approval queue before iterating hooks; pending posts do not accumulate social performance data.",
    });
  }

  if (cov === "no_published_posts") {
    findings.push({
      code: "nothing_posted",
      detail: "No governed posts have reached POSTED — there is no organic performance signal yet.",
    });
    return {
      status: "blocked",
      primaryDriver: postCounts.failed > 0 ? "publish_friction" : approval?.pendingApprovalCount ? "approval_friction" : "unknown",
      findings,
      recommendations,
      variantOpportunities,
      confidence: "low",
      metricsEcho,
    };
  }

  if (cov === "published_none_synced" || cov === "unsupported_only") {
    findings.push({
      code: "analytics_not_synced",
      detail:
        cov === "unsupported_only"
          ? "Published posts use providers without live metric sync in this deployment — stored snapshots may be missing."
          : "Published posts exist but no latest analytics snapshot is stored yet (refresh metrics or wait for sync).",
    });
    recommendations.push({
      kind: "measurement",
      text: "Run governed post metric refresh from the planner, or confirm platform adapters are live for your networks (see campaign analytics coverage).",
    });
    return {
      status: "blocked",
      primaryDriver: "unknown",
      findings,
      recommendations,
      variantOpportunities,
      confidence: "low",
      metricsEcho,
    };
  }

  if (s.postsWithLatestSnapshot < BENTLEY_OPT_MIN_PUBLISHED_SYNCED_FOR_ENGAGEMENT) {
    findings.push({
      code: "insufficient_synced_sample",
      detail: `Only ${s.postsWithLatestSnapshot} published post(s) have a stored metrics snapshot — wait for more data before trusting a single bottleneck.`,
    });
    recommendations.push({
      kind: "measurement",
      text: "Allow more posts to publish and sync, then re-run optimization.",
    });
    return {
      status: "insufficient_data",
      primaryDriver: "unknown",
      findings,
      recommendations,
      variantOpportunities,
      confidence: "low",
      metricsEcho,
    };
  }

  let primaryDriver: BentleyOptimizationPrimaryDriver = "unknown";
  let confidence: BentleyOptimizationConfidence =
    s.postsWithLatestSnapshot >= 3 ? "medium" : "low";

  if (impressionsOrReach != null && impressionsOrReach < BENTLEY_OPT_MIN_IMPRESSIONS_FOR_TRAFFIC_DIAGNOSIS) {
    primaryDriver = "traffic";
    findings.push({
      code: "low_impressions",
      detail: `Sum of impressions/reach from synced snapshots is below ${BENTLEY_OPT_MIN_IMPRESSIONS_FOR_TRAFFIC_DIAGNOSIS} — distribution or timing may be limiting visibility.`,
    });
    recommendations.push({
      kind: "platform_mix",
      text: "Expand posting to additional OAuth-connected platforms, widen posting windows, or increase cadence on networks that already sync impressions.",
    });
    variantOpportunities.push({
      kind: "platform_mix",
      label: "Broaden platform mix",
      rationale: "Low reach suggests distribution constraints before hook quality is the limiter.",
    });
  } else if (
    impressionsOrReach != null &&
    engN != null &&
    impressionsOrReach > 0 &&
    engN / impressionsOrReach < BENTLEY_OPT_ENGAGEMENT_RATIO_WEAK
  ) {
    primaryDriver = "engagement";
    findings.push({
      code: "weak_engagement_rate",
      detail: `Engagement (reactions/comments/shares/saves) relative to impressions is below ${(BENTLEY_OPT_ENGAGEMENT_RATIO_WEAK * 100).toFixed(1)}% — creative may need a stronger hook or clearer CTA.`,
    });
    recommendations.push({
      kind: "content",
      text: "Test alternate hooks and opening lines; keep the same offer but lead with a sharper pattern-interrupt in the first line.",
    });
    variantOpportunities.push({
      kind: "hook",
      label: "Stronger hook variants",
      rationale: "Engagement rate is weak despite measurable impressions.",
    });
  } else if (clicks != null && impressionsOrReach != null && impressionsOrReach > 500 && clicks / impressionsOrReach < 0.003) {
    primaryDriver = "conversion";
    findings.push({
      code: "weak_click_through",
      detail: "Click volume is low relative to impressions — CTA or offer clarity may be the bottleneck (social-only signal).",
    });
    recommendations.push({
      kind: "content",
      text: "Sharpen the single CTA, add proof or specificity, and align the caption with the landing expectation.",
    });
    variantOpportunities.push({
      kind: "cta",
      label: "CTA / clarity pass",
      rationale: "Clicks underperform relative to impressions.",
    });
  } else if (
    monthly &&
    typeof monthly.conversionRatePct === "number" &&
    monthly.conversionRatePct < 1 &&
    (monthly.traffic ?? 0) > 100
  ) {
    primaryDriver = "conversion";
    findings.push({
      code: "monthly_conversion_weak",
      detail: "Workspace monthly snapshot suggests sub-1% conversion with non-trivial traffic — treat funnel and offer as hypotheses (not proven by a single campaign).",
    });
    recommendations.push({
      kind: "operational",
      text: "Validate tracking and offer positioning; pair social creative tests with landing/checkout instrumentation.",
    });
    confidence = "low";
  } else if (monthly && typeof monthly.avgOrderValue === "number" && monthly.avgOrderValue > 0 && monthly.avgOrderValue < 50) {
    primaryDriver = "aov";
    findings.push({
      code: "monthly_aov_low",
      detail: "Monthly AOV snapshot is low — upsell bundles or tiered offers may help (business-level signal, low causal confidence per post).",
    });
    recommendations.push({
      kind: "content",
      text: "Emphasize bundle value and risk reversal in captions when promoting higher tiers.",
    });
    confidence = "low";
  } else {
    findings.push({
      code: "no_clear_bottleneck",
      detail: "Signals do not meet thresholds for a single primary driver — continue measuring or narrow the experiment.",
    });
    recommendations.push({
      kind: "measurement",
      text: "Keep publishing with consistent UTM; re-run after more synced snapshots or when a specific metric diverges from baseline.",
    });
    primaryDriver = "unknown";
  }

  if (postCounts.failed > 0) {
    primaryDriver = "publish_friction";
    confidence = "medium";
  } else if (approval && approval.overdueApprovalCount > 0) {
    primaryDriver = "approval_friction";
    confidence = "medium";
  }

  if (s.postsWithLatestSnapshot >= 4 && impressionsOrReach != null && impressionsOrReach >= 1500) {
    confidence = confidence === "low" ? "medium" : "high";
  }

  const priorLosing = priorHints?.losingPrimaryDrivers ?? [];
  const priorWinning = priorHints?.winningPrimaryDrivers ?? [];
  if (priorLosing.length && priorLosing.includes(primaryDriver)) {
    findings.push({
      code: "prior_variant_underperformed_same_driver",
      detail:
        "A previous optimization variant with a similar primary bottleneck did not beat the parent baseline — pivot the creative angle or wait for fresher reach before repeating the same hypothesis.",
    });
    recommendations.unshift({
      kind: "content",
      text: "Try a materially different hook or offer framing than the last variant; avoid repeating the same headline structure.",
    });
    variantOpportunities.unshift({
      kind: "hook",
      label: "Pivot hook angle",
      rationale: "Prior variant underperformed on this driver — test a distinct pattern-interrupt.",
    });
    if (confidence === "high") confidence = "medium";
  } else if (priorWinning.length && priorWinning.includes(primaryDriver)) {
    recommendations.unshift({
      kind: "measurement",
      text: "This driver improved in a prior variant — extend the winning angle with small controlled edits rather than a full rewrite.",
    });
  }

  return {
    status: "ready",
    primaryDriver,
    findings,
    recommendations,
    variantOpportunities,
    confidence,
    metricsEcho,
  };
}

/** Stable fingerprint for idempotent optimization runs (same inputs → same key prefix). */
export function metricsFingerprintFromSummary(result: BentleyOptimizationResult): string {
  return [
    result.status,
    result.primaryDriver,
    result.metricsEcho.coverageCode,
    String(result.metricsEcho.publishedPostCount),
    String(result.metricsEcho.postsWithLatestSnapshot),
    String(result.metricsEcho.aggregateImpressionsSum ?? ""),
    String(result.metricsEcho.failedPostCount),
  ].join(":");
}
