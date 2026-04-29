/**
 * Snapshot current Bentley SLI client filter state into a stable, serializable object.
 */

import type { SegmentDrilldown } from "../summaryDrilldown";
import type { BentleySliHandoffFiltersApplied } from "./contentBundleHandoffTypes";

export function buildSliHandoffFiltersApplied(args: {
  filterPlatform: string;
  filterAccess: string;
  filterOppMin: number;
  filterBuyerIntent: "" | "yes" | "no";
  filterWebsite: "" | "missing" | "present";
  filterEmail: "" | "yes" | "no";
  filterNextMove: string;
  filterPreset: string;
  filterQueue: string;
  filterCalibration: string;
  filterFeedback: string;
  filterProductivity: string;
  filterHandoff: string;
  segmentDrilldown: SegmentDrilldown | null;
}): BentleySliHandoffFiltersApplied {
  return {
    filterPlatform: args.filterPlatform,
    filterAccess: args.filterAccess,
    filterOppMin: args.filterOppMin,
    filterBuyerIntent: args.filterBuyerIntent,
    filterWebsite: args.filterWebsite,
    filterEmail: args.filterEmail,
    filterNextMove: args.filterNextMove,
    filterPreset: args.filterPreset,
    filterQueue: args.filterQueue,
    filterCalibration: args.filterCalibration,
    filterFeedback: args.filterFeedback,
    filterProductivity: args.filterProductivity,
    filterHandoff: args.filterHandoff,
    segmentDrilldown: args.segmentDrilldown
      ? { dimension: args.segmentDrilldown.dimension, value: args.segmentDrilldown.value }
      : null,
  };
}
