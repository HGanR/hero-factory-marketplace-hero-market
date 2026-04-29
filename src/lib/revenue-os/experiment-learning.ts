import type { FeedbackAggregationResult } from "@/lib/revenue-os/feedback-aggregation";
import type { ExperimentLearningAugmentation } from "@/lib/revenue-os/experiment-results";

function uniqMerge(preferredFirst: string[], second: string[], cap: number): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const x of [...preferredFirst, ...second]) {
    const k = x.trim();
    if (!k || seen.has(k.toLowerCase())) continue;
    seen.add(k.toLowerCase());
    out.push(k);
    if (out.length >= cap) break;
  }
  return out;
}

/**
 * Merges experiment-derived hook/angle signals into feedback aggregates for sweep scoring + decideNextAction.
 */
export function mergeExperimentAugmentationIntoFeedback(
  feedback: FeedbackAggregationResult,
  aug: ExperimentLearningAugmentation
): FeedbackAggregationResult {
  if (
    aug.boostHookTypes.length === 0 &&
    aug.suppressAngles.length === 0 &&
    aug.promotionThemes.length === 0
  ) {
    return feedback;
  }

  return {
    ...feedback,
    topPerformingHookTypes: uniqMerge(aug.boostHookTypes, feedback.topPerformingHookTypes, 16),
    underperformingTopics: uniqMerge(aug.suppressAngles, feedback.underperformingTopics, 16),
    topPerformingTopics: uniqMerge(aug.promotionThemes, feedback.topPerformingTopics, 16),
    experimentBoostHookTypes: aug.boostHookTypes.length ? aug.boostHookTypes : feedback.experimentBoostHookTypes,
    experimentSuppressAngles: aug.suppressAngles.length ? aug.suppressAngles : feedback.experimentSuppressAngles,
    experimentPromotionThemes: aug.promotionThemes.length ? aug.promotionThemes : feedback.experimentPromotionThemes,
  };
}
