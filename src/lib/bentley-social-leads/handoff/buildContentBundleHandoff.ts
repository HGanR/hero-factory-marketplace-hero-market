/**
 * Pure builder: filtered SLI rows + insights → structured handoff payload.
 */

import type { ContentInsightsBatch, EngineLeadBatchSummary } from "../engine/domainTypes";
import type { LeadAnalysisRow } from "../queryTypes";
import {
  BENTLEY_CONTENT_BUNDLE_HANDOFF_SCHEMA_VERSION,
  type BentleyContentBundleHandoff,
  type BentleyContentBundleHandoffProvenance,
  type BentleySliHandoffFiltersApplied,
  type EngineBatchSummarySubset,
} from "./contentBundleHandoffTypes";

function uniqueSortedPlatforms(rows: LeadAnalysisRow[]): string[] {
  const s = new Set<string>();
  for (const r of rows) {
    if (r.platform?.trim()) s.add(r.platform.trim());
  }
  return [...s].sort();
}

function subsetEngineSummary(full: EngineLeadBatchSummary): EngineBatchSummarySubset {
  return {
    totalLeads: full.totalLeads,
    avgIntentScore0To100: full.avgIntentScore0To100,
    avgConfidence0To1: full.avgConfidence0To1,
    byPlatform: { ...full.byPlatform },
    byPainType: { ...full.byPainType },
    byUrgency: { ...full.byUrgency },
    byCommercialStage: { ...full.byCommercialStage },
    byHandoffReadiness: { ...full.byHandoffReadiness },
  };
}

export function buildContentBundleHandoff(params: {
  insights: ContentInsightsBatch;
  engineSummary: EngineLeadBatchSummary;
  filteredRows: LeadAnalysisRow[];
  totalRunRowCount: number;
  filtersApplied: BentleySliHandoffFiltersApplied;
  provenance: Omit<BentleyContentBundleHandoffProvenance, "filteredLeadRecordIds" | "filteredAnalysisIds"> & {
    filteredLeadRecordIds: string[];
    filteredAnalysisIds: string[];
  };
  createdAt?: string;
}): BentleyContentBundleHandoff {
  const createdAt = params.createdAt ?? new Date().toISOString();
  return {
    source: "bentley_sli",
    schemaVersion: BENTLEY_CONTENT_BUNDLE_HANDOFF_SCHEMA_VERSION,
    createdAt,
    basedOnFilteredRowCount: params.filteredRows.length,
    filtersApplied: params.filtersApplied,
    provenance: {
      ...params.provenance,
      filteredLeadRecordIds: params.provenance.filteredLeadRecordIds.slice(0, 500),
      filteredAnalysisIds: params.provenance.filteredAnalysisIds.slice(0, 500),
    },
    platformsInvolved: uniqueSortedPlatforms(params.filteredRows),
    topPainThemes: params.insights.topRecurringPainThemes.slice(0, 24),
    marketSummary: params.insights.marketSummary,
    hooks: params.insights.hookIdeas.slice(0, 24),
    ctaAngles: params.insights.ctaAngles.slice(0, 24),
    offerAngles: params.insights.offerAngles.slice(0, 24),
    objections: params.insights.topObjections.slice(0, 24),
    pillars: params.insights.contentPillars.slice(0, 24),
    whatToPostNext: params.insights.whatToPostNext.slice(0, 24),
    engineBatchSummary: subsetEngineSummary(params.engineSummary),
    contentInsightsSchemaVersion: params.insights.schemaVersion,
  };
}
