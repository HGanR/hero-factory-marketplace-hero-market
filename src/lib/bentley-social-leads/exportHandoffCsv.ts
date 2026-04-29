/**
 * Wide “operator handoff” CSV — inferred vs effective, rationale, drivers, evidence, overrides, workflow.
 */

import type { LeadAnalysisRow } from "./queryTypes";

function esc(s: string | null | undefined) {
  const v = (s ?? "").replace(/"/g, '""');
  return `"${v}"`;
}

function evidenceFlat(r: LeadAnalysisRow): string {
  const e = r.evidenceJson;
  if (!e) return "";
  const parts: string[] = [];
  parts.push(...e.weakSpots.slice(0, 4).map((x) => `[ws] ${x}`));
  parts.push(...e.repeatedBuyerQuestions.slice(0, 3).map((x) => `[q] ${x}`));
  parts.push(...e.objectionThemes.slice(0, 2).map((x) => `[o] ${x}`));
  parts.push(...e.demandSignals.slice(0, 3).map((x) => `[d] ${x}`));
  parts.push(...e.actionRationale.slice(0, 2).map((x) => `[a] ${x}`));
  return parts.join(" || ").slice(0, 8000);
}

export function exportHandoffCsv(rows: LeadAnalysisRow[]): string {
  const headers = [
    "leadRecordId",
    "analysisId",
    "businessName",
    "platform",
    "handle",
    "email",
    "websiteUrl",
    "inferredVertical",
    "inferredLeadType",
    "effectiveLeadType",
    "commercialReadiness",
    "effectiveCommercialReadiness",
    "opportunityScore",
    "confidenceScore",
    "fitScore",
    "overallCoverageScore",
    "accessStatus",
    "bestOfferAngle_inferred",
    "bestOfferAngle_effective",
    "weakSpots_inferred_csv",
    "weakSpots_effective_csv",
    "suggestedNextMove",
    "actionRationale",
    "topPositiveDrivers",
    "limitingFactors",
    "evidence_snippets_flat",
    "operatorOverrideLeadType",
    "operatorOverrideCommercialReadiness",
    "operatorOverrideBestOfferAngle",
    "operatorOverrideWeakSpotsJson",
    "operatorOverrideLeadTypeReason",
    "operatorOverrideCommercialReadinessReason",
    "operatorOverrideBestOfferAngleReason",
    "operatorOverrideWeakSpotsReason",
    "operatorFeedbackLeadType",
    "operatorFeedbackCommercialReadiness",
    "operatorFeedbackWeakSpots",
    "operatorFeedbackBestOfferAngle",
    "operatorStatus",
    "operatorPriority",
    "operatorNotes",
    "manuallyReviewedAt",
    "summary",
  ];

  const lines = [headers.join(",")];
  for (const r of rows) {
    const td = r.topLeadDriversJson;
    lines.push(
      [
        esc(r.leadRecordId),
        esc(r.analysisId),
        esc(r.businessName),
        esc(r.platform),
        esc(r.handle),
        esc(r.email),
        esc(r.websiteUrl),
        esc(r.inferredVertical),
        esc(r.inferredLeadType),
        esc(r.effectiveLeadType),
        esc(r.commercialReadiness),
        esc(r.effectiveCommercialReadiness),
        esc(String(r.opportunityScore)),
        esc(String(r.confidenceScore)),
        esc(String(r.fitScore)),
        esc(String(r.overallCoverageScore)),
        esc(r.accessStatus),
        esc(r.bestOfferAngle),
        esc(r.effectiveBestOfferAngle),
        esc(r.inferredWeakSpots.join(",")),
        esc(r.effectiveWeakSpots.join(",")),
        esc(r.suggestedNextMove),
        esc(r.actionRationale),
        esc((td?.topPositive ?? []).join(" | ")),
        esc((td?.limitingFactors ?? []).join(" | ")),
        esc(evidenceFlat(r)),
        esc(r.operatorOverrideLeadType),
        esc(r.operatorOverrideCommercialReadiness),
        esc(r.operatorOverrideBestOfferAngle),
        esc(r.operatorOverrideWeakSpotsJson.join(",")),
        esc(r.operatorOverrideLeadTypeReason),
        esc(r.operatorOverrideCommercialReadinessReason),
        esc(r.operatorOverrideBestOfferAngleReason),
        esc(r.operatorOverrideWeakSpotsReason),
        esc(r.operatorFeedbackLeadType),
        esc(r.operatorFeedbackCommercialReadiness),
        esc(r.operatorFeedbackWeakSpots),
        esc(r.operatorFeedbackBestOfferAngle),
        esc(r.operatorStatus),
        esc(r.operatorPriority),
        esc(r.operatorNotes),
        esc(r.manuallyReviewedAt),
        esc(r.summary),
      ].join(",")
    );
  }
  return lines.join("\n");
}
