/**
 * Product-safe Instagram-first preference when optimization memory shows strong measured Instagram signals.
 * Gates are conservative; does not replace other platforms or global routing.
 */

import type {
  InstagramMeasuredPreferenceSummary,
  RevenueOsOptimizationMemoryEntry,
  RevenueOsOptimizationMemorySummary,
} from "@/lib/revenue-os/post-optimization-memory-types";

/** Aligns with high-confidence live_metrics bar (≥4 publishes + measured signals in bucket). */
export const MIN_INSTAGRAM_MEASURED_PUBLISH_VOLUME = 4;

function normPlatform(p: string | null | undefined): string {
  return (p ?? "").trim().toLowerCase();
}

/**
 * Compact line for unified generation prompts (single sentence; subordinate to user/brief).
 */
export function buildInstagramMeasuredPreferencePromptHint(): string {
  return (
    "Attention-led preference: Instagram has the strongest validated reach-style (impressions) signal from synced posts — not the same as engagement-only leaders on other channels. " +
    "Favor Instagram-compatible hooks slightly unless contradicted by user goals; still include other platforms."
  );
}

/**
 * Returns a summary only when all gates pass; otherwise null.
 */
export function evaluateInstagramMeasuredPreference(
  enrichedEntries: RevenueOsOptimizationMemoryEntry[],
  summary: RevenueOsOptimizationMemorySummary
): InstagramMeasuredPreferenceSummary | null {
  if (!summary.hasEnoughData) return null;

  const attentionLeader =
    summary.measuredStrongestAttentionPlatform ?? summary.measuredStrongestPlatform ?? undefined;
  if (normPlatform(attentionLeader) !== "instagram") {
    return null;
  }

  const igMeasuredInformative = enrichedEntries.filter(
    (e) =>
      normPlatform(e.platform) === "instagram" &&
      e.evidenceQuality === "live_metrics" &&
      e.outcomeKind !== "insufficient_data" &&
      (e.outcomeKind === "positive" || e.outcomeKind === "mixed")
  );

  const measuredPublishingVolume = igMeasuredInformative.reduce(
    (acc, e) => acc + (e.evidence.publishCount ?? 0),
    0
  );
  if (measuredPublishingVolume < MIN_INSTAGRAM_MEASURED_PUBLISH_VOLUME) {
    return null;
  }

  const entryHigh = igMeasuredInformative.some((e) => e.confidence === "high");
  const summaryHigh = summary.summaryConfidence === "high";
  if (!entryHigh && !summaryHigh) {
    return null;
  }

  const confidenceLabel: "high" | "medium" = entryHigh || summaryHigh ? "high" : "medium";

  return {
    active: true,
    measuredPublishingVolume,
    measuredMetricPostCount: measuredPublishingVolume,
    userHeadline: "Measured preference: Instagram",
    userWhy: "Highest measured attention (impressions-style) from synced Instagram posts in optimization memory vs other channels’ available metrics.",
    confidenceLabel,
  };
}
