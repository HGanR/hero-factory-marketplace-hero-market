/**
 * Structured handoff from Bentley SLI → AI Revenue OS / Content Bundle (operator-initiated; audit-friendly).
 */

import type { ContentInsightsBatch, EngineLeadBatchSummary } from "../engine/domainTypes";

export const BENTLEY_CONTENT_BUNDLE_HANDOFF_SCHEMA_VERSION = 1 as const;

export type BentleyContentBundleHandoffSource = "bentley_sli";

/** Serializable filter snapshot (explicit primitives for stable hashing / audit). */
export type BentleySliHandoffFiltersApplied = {
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
  segmentDrilldown: { dimension: string; value: string } | null;
};

export type BentleyContentBundleHandoffProvenance = {
  uploadId: string | null;
  runId: string | null;
  uploadSourceType: string | null;
  uploadFilename: string | null;
  /** When upload was CSV SLI import */
  csvImportFileName: string | null;
  csvValidRowsImported: number | null;
  totalRunRowCount: number;
  /** Stable identifiers for the filtered slice used to build insights */
  filteredLeadRecordIds: string[];
  filteredAnalysisIds: string[];
};

export type EngineBatchSummarySubset = Pick<
  EngineLeadBatchSummary,
  | "totalLeads"
  | "avgIntentScore0To100"
  | "avgConfidence0To1"
  | "byPlatform"
  | "byPainType"
  | "byUrgency"
  | "byCommercialStage"
  | "byHandoffReadiness"
>;

export type BentleyContentBundleHandoffMeta = {
  source: BentleyContentBundleHandoffSource;
  schemaVersion: typeof BENTLEY_CONTENT_BUNDLE_HANDOFF_SCHEMA_VERSION;
  /** Set when persisted server-side */
  handoffId?: string;
  createdAt: string;
  basedOnFilteredRowCount: number;
  filtersApplied: BentleySliHandoffFiltersApplied;
  provenance: BentleyContentBundleHandoffProvenance;
};

/**
 * Full payload stored in DB and mirrored into workflow / review UIs.
 * Distinct from downstream generated content (Content Bundle output).
 */
export type BentleyContentBundleHandoff = BentleyContentBundleHandoffMeta & {
  platformsInvolved: string[];
  topPainThemes: ContentInsightsBatch["topRecurringPainThemes"];
  marketSummary: string;
  hooks: string[];
  ctaAngles: string[];
  offerAngles: string[];
  objections: ContentInsightsBatch["topObjections"];
  pillars: string[];
  whatToPostNext: string[];
  engineBatchSummary: EngineBatchSummarySubset;
  contentInsightsSchemaVersion: number;
};

export type BentleyContentBundleReadableNotes = {
  title: string;
  /** Multi-section markdown suitable for human review */
  compactMarkdown: string;
  /** One block for pasting into single-line notes fields */
  singleBlock: string;
};

export type ContentBundleHandoffApiResponse = {
  ok: true;
  handoffId: string;
  createdAt: string;
};

export type ContentBundleHandoffApiError = {
  ok: false;
  error: string;
};
