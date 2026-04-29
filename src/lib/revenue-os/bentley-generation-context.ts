/**
 * Normalized generation context for optional Bentley SLI → Content Bundle handoff (Phase 4C).
 * Preserves separation: user-authored input vs Bentley market intelligence.
 */

import type { BentleyContentBundleHandoff } from "@/lib/bentley-social-leads/handoff/contentBundleHandoffTypes";
import type { ContentInsightsBatch } from "@/lib/bentley-social-leads/engine/domainTypes";

/** Marker used to avoid stacking duplicate Bentley sections in legacy single-string merges. */
export const BENTLEY_MARKET_INTELLIGENCE_HEADING = "Bentley SLI Market Intelligence";

export function buildBentleyMarketIntelligenceMarker(handoffId?: string): string {
  return handoffId
    ? `${BENTLEY_MARKET_INTELLIGENCE_HEADING} (handoff: ${handoffId})`
    : BENTLEY_MARKET_INTELLIGENCE_HEADING;
}

export type BentleyHandoffResolveSource = "handoff_id_db" | "request_payload" | "none";

/** Structured slice passed to prompt builders / JSON-aware generators (not raw DB row duplication). */
export type BentleyStructuredMarketIntelligence = {
  source: "bentley_sli";
  handoffId?: string;
  createdAt: string;
  basedOnFilteredRowCount: number;
  provenance: {
    uploadId: string | null;
    runId: string | null;
    uploadSourceType: string | null;
    uploadFilename: string | null;
    csvImportFileName: string | null;
    csvValidRowsImported: number | null;
    totalRunRowCount: number;
  };
  platformsInvolved: string[];
  marketSummary: string;
  topPainThemes: ContentInsightsBatch["topRecurringPainThemes"];
  hooks: string[];
  ctaAngles: string[];
  offerAngles: string[];
  objections: ContentInsightsBatch["topObjections"];
  pillars: string[];
  whatToPostNext: string[];
};

export type BentleyGenerationContext = {
  /** Operator / user notes only — never modified in place. */
  userNotesOriginal: string;
  /** Resolved handoff used for this generation, if any. */
  bentleyHandoff: BentleyContentBundleHandoff | null;
  resolvedFrom: BentleyHandoffResolveSource;
  /** Human-readable block derived from handoff (deterministic; for legacy note fields). */
  bentleyReadableNotesBlock: string;
  /** Structured intelligence for JSON sections / prompt assembly. */
  bentleyMarketIntelligence: BentleyStructuredMarketIntelligence | null;
};

export function toBentleyStructuredMarketIntelligence(
  h: BentleyContentBundleHandoff
): BentleyStructuredMarketIntelligence {
  return {
    source: "bentley_sli",
    handoffId: h.handoffId,
    createdAt: h.createdAt,
    basedOnFilteredRowCount: h.basedOnFilteredRowCount,
    provenance: {
      uploadId: h.provenance.uploadId,
      runId: h.provenance.runId,
      uploadSourceType: h.provenance.uploadSourceType,
      uploadFilename: h.provenance.uploadFilename,
      csvImportFileName: h.provenance.csvImportFileName,
      csvValidRowsImported: h.provenance.csvValidRowsImported,
      totalRunRowCount: h.provenance.totalRunRowCount,
    },
    platformsInvolved: h.platformsInvolved,
    marketSummary: h.marketSummary,
    topPainThemes: h.topPainThemes,
    hooks: h.hooks,
    ctaAngles: h.ctaAngles,
    offerAngles: h.offerAngles,
    objections: h.objections,
    pillars: h.pillars,
    whatToPostNext: h.whatToPostNext,
  };
}

/** Stable fingerprint so synthesis / generation re-runs when the attached handoff changes. */
export function buildBentleyHandoffFingerprint(h: BentleyContentBundleHandoff | null | undefined): string {
  if (!h) return "";
  return `${h.handoffId ?? "ephemeral"}|${h.createdAt}|${h.basedOnFilteredRowCount}`;
}
