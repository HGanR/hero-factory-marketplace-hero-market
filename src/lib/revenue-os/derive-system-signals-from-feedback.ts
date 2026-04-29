/**
 * Conservative nudges to 5-system scores from deployment feedback (sparse-safe).
 */

import type { AttentionSignalStrength } from "@/lib/revenue-os/deployment-feedback-summary";
import type { RevenueOsSystemSignals } from "@/lib/revenue-os/revenue-os-system-signals-types";

export type DeploymentFeedbackSignalsInput = {
  publishedCount: number;
  failedCount: number;
  retryScheduledCount: number;
  hasPerformanceMetrics: boolean;
  /** Distinct platforms with at least one published feedback row */
  publishedPlatforms: number;
  /** Sum of engagement-like signals when metrics exist (optional coarse total) */
  engagementSignalStrength?: number;
  leadCount?: number;
  /** From deployment rollup — when set, performance nudges prefer measured totals over publish-only. */
  bestMeasuredPlatform?: string;
  bestPublishedPlatform?: string;
  attentionSignalStrength?: AttentionSignalStrength;
  /** metricScore totals on live-metrics platforms only */
  measuredEngagementTotal?: number;
  /** metricScore totals on publish-only / unsupported / unknown platforms */
  publishOnlyEngagementTotal?: number;
  /** Distinct posts contributing to `measuredEngagementTotal` (dampens tiny samples). */
  measuredMetricPostCount?: number;
  /** Optional routing hooks — not used by score nudges today (future signal enrichment). */
  bestAttentionPlatform?: string;
  bestEngagementPlatform?: string;
  comparisonConfidence?: string;
  /** True when any deduped metric row reports clicks > 0 (lead-capture routing only; not a conversion claim). */
  anyReportedClicks?: boolean;
};

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

/**
 * Scalar used for opportunity / offer nudges. When split totals are present, live-metrics evidence
 * dominates; publish-only contributes a capped tail so operational volume does not mimic performance.
 * When split fields are absent, falls back to `engagementSignalStrength` (legacy).
 */
export function computeEvidenceAwarePerformanceEngagement(fb: DeploymentFeedbackSignalsInput): number {
  const legacy = fb.engagementSignalStrength ?? 0;
  const mTotal = fb.measuredEngagementTotal;
  const pTotal = fb.publishOnlyEngagementTotal;
  if (mTotal === undefined || pTotal === undefined) {
    return legacy;
  }
  const postCount = Math.max(0, fb.measuredMetricPostCount ?? 0);
  const measuredPostsForDampen = mTotal > 0 ? Math.max(1, postCount) : 0;
  const dampen =
    measuredPostsForDampen > 0 ? Math.min(1, Math.sqrt(measuredPostsForDampen) / Math.sqrt(5)) : 1;
  const measuredPart = mTotal * dampen;
  if (measuredPart > 0) {
    const publishTail = Math.min(pTotal * 0.12, 12 + measuredPart * 0.35);
    return measuredPart + publishTail;
  }
  return pTotal > 0 ? pTotal : legacy;
}

/**
 * Merges into existing partial scores only where base already defined a value
 * (avoids inventing scores from feedback alone).
 */
export function enrichSystemSignalsFromFeedback(
  base: RevenueOsSystemSignals,
  fb: DeploymentFeedbackSignalsInput | null | undefined
): RevenueOsSystemSignals {
  if (!fb || (fb.publishedCount === 0 && fb.failedCount === 0 && fb.retryScheduledCount === 0)) {
    return { ...base };
  }

  const out: RevenueOsSystemSignals = { ...base };

  const totalOutcomes = fb.publishedCount + fb.failedCount + fb.retryScheduledCount;
  const failRate = totalOutcomes > 0 ? fb.failedCount / totalOutcomes : 0;

  if (base.trafficReadinessScore !== undefined && fb.publishedCount >= 2 && fb.publishedPlatforms >= 2) {
    const bump = Math.min(6, fb.publishedCount + fb.publishedPlatforms);
    out.trafficReadinessScore = clamp(base.trafficReadinessScore + bump);
  } else if (base.trafficReadinessScore !== undefined && fb.publishedCount === 1) {
    out.trafficReadinessScore = clamp(base.trafficReadinessScore + 2);
  }

  if (
    base.trafficReadinessScore !== undefined &&
    fb.bestMeasuredPlatform &&
    fb.attentionSignalStrength &&
    fb.attentionSignalStrength !== "none"
  ) {
    const attnBump =
      fb.attentionSignalStrength === "strong" ? 2 : fb.attentionSignalStrength === "promising" ? 1 : 1;
    const cur = out.trafficReadinessScore ?? base.trafficReadinessScore;
    out.trafficReadinessScore = clamp(cur + Math.min(3, attnBump));
  }

  if (base.executionGapScore !== undefined && totalOutcomes >= 4 && failRate >= 0.45) {
    out.executionGapScore = clamp(base.executionGapScore + Math.min(8, Math.round(failRate * 10)));
  } else if (base.executionGapScore !== undefined && fb.retryScheduledCount >= 3) {
    out.executionGapScore = clamp(base.executionGapScore + 4);
  }

  const perfEngagement = computeEvidenceAwarePerformanceEngagement(fb);

  if (
    base.opportunityScore !== undefined &&
    fb.hasPerformanceMetrics &&
    perfEngagement > 5 &&
    fb.publishedCount >= 2
  ) {
    out.opportunityScore = clamp(base.opportunityScore + Math.min(5, Math.round(perfEngagement / 20)));
  }

  if (
    base.offerStrengthScore !== undefined &&
    fb.hasPerformanceMetrics &&
    perfEngagement > 15 &&
    fb.publishedCount >= 2
  ) {
    out.offerStrengthScore = clamp(base.offerStrengthScore + Math.min(6, Math.round(perfEngagement / 25)));
  }

  if (base.capitalReadinessScore !== undefined && (fb.leadCount ?? 0) >= 1) {
    out.capitalReadinessScore = clamp(base.capitalReadinessScore + Math.min(8, (fb.leadCount ?? 0) * 3));
  }

  out.deploymentFeedbackEnriched = true;
  return out;
}
