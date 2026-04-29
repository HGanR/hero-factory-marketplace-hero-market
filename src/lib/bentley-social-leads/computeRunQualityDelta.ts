/**
 * Compare two run batch summaries (e.g. calibration / A–B run quality).
 */

import type { RunBatchSummary } from "./computeBatchSummary";

export type RunQualityComparisonDelta = {
  deltaAverageCoverage: number;
  deltaAverageConfidence: number;
  deltaPercentPublic: number;
  deltaPercentWithEvidence: number;
  deltaPercentWithRepeatedAcrossPosts: number;
  deltaPercentWithOverrides: number;
  deltaPercentFeedbackPresent: number;
  deltaPercentLeadTypeIncorrect: number;
  deltaPercentCommercialReadinessIncorrect: number;
  deltaPercentWeakSpotsIncorrect: number;
  deltaPercentBestOfferAngleIncorrect: number;
  deltaAvgConfidenceIncorrect: number | null;
};

export function computeRunQualityDelta(
  current: RunBatchSummary,
  baseline: RunBatchSummary
): RunQualityComparisonDelta {
  const deltaAvgConf =
    current.avgConfidenceForIncorrectFindings != null && baseline.avgConfidenceForIncorrectFindings != null
      ? current.avgConfidenceForIncorrectFindings - baseline.avgConfidenceForIncorrectFindings
      : null;

  return {
    deltaAverageCoverage: current.averageCoverage - baseline.averageCoverage,
    deltaAverageConfidence: current.averageConfidence - baseline.averageConfidence,
    deltaPercentPublic: current.percentPublic - baseline.percentPublic,
    deltaPercentWithEvidence: current.percentWithEvidence - baseline.percentWithEvidence,
    deltaPercentWithRepeatedAcrossPosts:
      current.percentWithRepeatedAcrossPosts - baseline.percentWithRepeatedAcrossPosts,
    deltaPercentWithOverrides: current.percentWithOverrides - baseline.percentWithOverrides,
    deltaPercentFeedbackPresent: current.percentFeedbackPresent - baseline.percentFeedbackPresent,
    deltaPercentLeadTypeIncorrect: current.percentLeadTypeIncorrect - baseline.percentLeadTypeIncorrect,
    deltaPercentCommercialReadinessIncorrect:
      current.percentCommercialReadinessIncorrect - baseline.percentCommercialReadinessIncorrect,
    deltaPercentWeakSpotsIncorrect: current.percentWeakSpotsIncorrect - baseline.percentWeakSpotsIncorrect,
    deltaPercentBestOfferAngleIncorrect:
      current.percentBestOfferAngleIncorrect - baseline.percentBestOfferAngleIncorrect,
    deltaAvgConfidenceIncorrect: deltaAvgConf,
  };
}
