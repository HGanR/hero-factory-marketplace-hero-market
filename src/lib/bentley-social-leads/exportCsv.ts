/**
 * CSV export for operator review — analysis-only fields, no automated outreach payloads.
 */

import type { LeadAnalysisRow } from "./queryTypes";

export function analysesToCsv(rows: LeadAnalysisRow[]): string {
  const headers = [
    "leadRecordId",
    "analysisId",
    "businessName",
    "platform",
    "inferredVertical",
    "inferredLeadType",
    "effectiveLeadType",
    "commercialReadiness",
    "effectiveCommercialReadiness",
    "handle",
    "email",
    "websiteUrl",
    "accessStatus",
    "overallCoverageScore",
    "businessType",
    "maturityStage",
    "opportunityScore",
    "confidenceScore",
    "visibilityScore",
    "demandScore",
    "intentScore",
    "frictionScore",
    "fitScore",
    "bestOfferAngle",
    "effectiveBestOfferAngle",
    "suggestedNextMove",
    "actionRationale",
    "summary",
    "operatorStatus",
    "operatorPriority",
    "operatorNotes",
    "manuallyReviewedAt",
  ];

  const esc = (s: string | null | undefined) => {
    const v = (s ?? "").replace(/"/g, '""');
    return `"${v}"`;
  };

  const lines = [headers.join(",")];
  for (const r of rows) {
    lines.push(
      [
        esc(r.leadRecordId),
        esc(r.analysisId),
        esc(r.businessName),
        esc(r.platform),
        esc(r.inferredVertical),
        esc(r.inferredLeadType),
        esc(r.effectiveLeadType),
        esc(r.commercialReadiness),
        esc(r.effectiveCommercialReadiness),
        esc(r.handle),
        esc(r.email),
        esc(r.websiteUrl),
        esc(r.accessStatus),
        esc(String(r.overallCoverageScore)),
        esc(r.businessType),
        esc(r.maturityStage),
        esc(String(r.opportunityScore)),
        esc(String(r.confidenceScore)),
        esc(String(r.visibilityScore)),
        esc(String(r.demandScore)),
        esc(String(r.intentScore)),
        esc(String(r.frictionScore)),
        esc(String(r.fitScore)),
        esc(r.bestOfferAngle),
        esc(r.effectiveBestOfferAngle),
        esc(r.suggestedNextMove),
        esc(r.actionRationale),
        esc(r.summary),
        esc(r.operatorStatus),
        esc(r.operatorPriority),
        esc(r.operatorNotes),
        esc(r.manuallyReviewedAt),
      ].join(",")
    );
  }
  return lines.join("\n");
}
