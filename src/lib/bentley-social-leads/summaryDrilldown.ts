/**
 * Pure helpers for run-summary → table filter drilldowns (testable mapping).
 */

import type { DriftFlagsJson } from "./computeBatchSummary";
import type { LeadAnalysisRow } from "./queryTypes";

export type SegmentDrilldownDimension = "vertical" | "lead_type" | "platform" | "readiness";

export type SegmentDrilldown = {
  dimension: SegmentDrilldownDimension;
  value: string;
};

/** Clears unrelated segment filters when applying a new drilldown (caller merges). */
export type DrilldownFilterPatch = {
  filterFeedback: string;
  filterCalibration: string;
  filterQueue: string;
  filterPreset: string;
  filterHandoff: string;
  filterProductivity: string;
  segmentDrilldown: SegmentDrilldown | null;
  /** Substring for platform contains (optional; use with segment for platform exact via row matcher). */
  filterPlatform: string;
  filterNextMove: string;
};

export const EMPTY_DRILLDOWN_PATCH: DrilldownFilterPatch = {
  filterFeedback: "",
  filterCalibration: "",
  filterQueue: "",
  filterPreset: "",
  filterHandoff: "",
  filterProductivity: "",
  segmentDrilldown: null,
  filterPlatform: "",
  filterNextMove: "",
};

export function rowMatchesSegmentDrilldown(
  row: LeadAnalysisRow,
  d: SegmentDrilldown | null
): boolean {
  if (!d) return true;
  switch (d.dimension) {
    case "vertical":
      return (row.inferredVertical || "unknown") === d.value;
    case "lead_type":
      return (row.effectiveLeadType || "unknown") === d.value;
    case "platform":
      return (row.platform || "unknown") === d.value;
    case "readiness":
      return (row.effectiveCommercialReadiness || "unknown") === d.value;
    default:
      return true;
  }
}

export type DriftDrilldownId =
  | "lead_type_miscalibration"
  | "readiness_miscalibration"
  | "offer_partial_vertical"
  | "weak_override_lead_type"
  | "weak_override_platform"
  | "neg_feedback_low_cov";

export function drilldownPatchForDrift(
  id: DriftDrilldownId,
  flags: DriftFlagsJson
): DrilldownFilterPatch | null {
  switch (id) {
    case "lead_type_miscalibration":
      if (!flags.highConfidenceHighLeadTypeIncorrectRate) return null;
      return {
        ...EMPTY_DRILLDOWN_PATCH,
        filterFeedback: "incorrect_lead_type",
        filterCalibration: "high_opp_low_conf",
      };
    case "readiness_miscalibration":
      if (!flags.highConfidenceHighReadinessIncorrectRate) return null;
      return {
        ...EMPTY_DRILLDOWN_PATCH,
        filterFeedback: "incorrect_readiness",
        filterCalibration: "high_opp_low_conf",
      };
    case "offer_partial_vertical": {
      const v = flags.offerAnglePartiallyCorrectVerticalSpike;
      if (!v) return null;
      return {
        ...EMPTY_DRILLDOWN_PATCH,
        filterFeedback: "partial_offer_angle",
        segmentDrilldown: { dimension: "vertical", value: v.vertical },
      };
    }
    case "weak_override_lead_type": {
      const v = flags.weakSpotsOverrideSpikeLeadType;
      if (!v) return null;
      return {
        ...EMPTY_DRILLDOWN_PATCH,
        filterQueue: "override_applied",
        segmentDrilldown: { dimension: "lead_type", value: v.leadType },
      };
    }
    case "weak_override_platform": {
      const v = flags.weakSpotsOverrideSpikePlatform;
      if (!v) return null;
      return {
        ...EMPTY_DRILLDOWN_PATCH,
        filterQueue: "override_applied",
        segmentDrilldown: { dimension: "platform", value: v.platform },
      };
    }
    case "neg_feedback_low_cov":
      if (!flags.repeatedNegativeFeedbackUnderLowCoverage) return null;
      return {
        ...EMPTY_DRILLDOWN_PATCH,
        filterQueue: "low_cov_high_opp",
        filterFeedback: "high_opp_negative_fb",
      };
    default:
      return null;
  }
}

export function drilldownPatchForCalibrationFinding(
  finding: "lead_type" | "commercial_readiness" | "weak_spots" | "best_offer_angle"
): DrilldownFilterPatch {
  const fb: Record<typeof finding, string> = {
    lead_type: "incorrect_lead_type",
    commercial_readiness: "incorrect_readiness",
    weak_spots: "incorrect_weak_spots",
    best_offer_angle: "incorrect_offer_angle",
  };
  return {
    ...EMPTY_DRILLDOWN_PATCH,
    filterFeedback: fb[finding],
    filterCalibration: "high_opp_low_conf",
  };
}

export function drilldownPatchForQualityRow(
  dimension: SegmentDrilldownDimension,
  segmentKey: string
): DrilldownFilterPatch {
  return {
    ...EMPTY_DRILLDOWN_PATCH,
    segmentDrilldown: { dimension, value: segmentKey },
  };
}

export function drilldownPatchForHandoffBucket(bucket: "ready" | "review_needed" | "not_ready"): DrilldownFilterPatch {
  if (bucket === "ready") {
    return { ...EMPTY_DRILLDOWN_PATCH, filterHandoff: "handoff_ready" };
  }
  if (bucket === "review_needed") {
    return { ...EMPTY_DRILLDOWN_PATCH, filterHandoff: "handoff_review" };
  }
  return { ...EMPTY_DRILLDOWN_PATCH, filterHandoff: "handoff_not_ready" };
}
