/**
 * Derived handoff readiness — analysis-only; no automated outreach.
 */

import type { EvidenceByFinding, HandoffReadiness } from "./types";
import type { LeadAnalysisRow } from "./queryTypes";

export type { HandoffReadiness };

export type HandoffReadinessDerivation = {
  handoffReadiness: HandoffReadiness;
  /** Human-readable completeness / gap notes (empty when ready). */
  handoffReadinessReasons: string[];
};

function evidenceHasContent(e: EvidenceByFinding | null | undefined): boolean {
  if (!e) return false;
  return (
    e.weakSpots.length > 0 ||
    e.repeatedBuyerQuestions.length > 0 ||
    e.objectionThemes.length > 0 ||
    e.demandSignals.length > 0 ||
    e.actionRationale.length > 0
  );
}

/** Override reason completeness when any value override exists. */
function overrideReasonsComplete(r: LeadAnalysisRow): boolean {
  if (!r.hasOperatorFieldOverrides) return true;
  if (r.operatorOverrideLeadType && !r.operatorOverrideLeadTypeReason?.trim()) return false;
  if (r.operatorOverrideCommercialReadiness && !r.operatorOverrideCommercialReadinessReason?.trim()) return false;
  if (
    typeof r.operatorOverrideBestOfferAngle === "string" &&
    r.operatorOverrideBestOfferAngle.trim().length > 0 &&
    !r.operatorOverrideBestOfferAngleReason?.trim()
  ) {
    return false;
  }
  if (r.weakSpotsOverrideActive && !r.operatorOverrideWeakSpotsReason?.trim()) return false;
  return true;
}

/**
 * ready: strong operator signal + trust artifacts present + calibration not collapsed.
 * review_needed: usable but missing review, reasons, or borderline confidence/coverage.
 * not_ready: insufficient surface or missing core rationale/next step.
 */
export function deriveHandoffReadinessWithReasons(r: LeadAnalysisRow): HandoffReadinessDerivation {
  const hasEvidence = evidenceHasContent(r.evidenceJson);
  const hasRationale = Boolean(r.actionRationale?.trim());
  const hasNext = Boolean(r.suggestedNextMove?.trim());
  const covVeryLow = r.overallCoverageScore < 0.28;
  const confVeryLow = r.confidenceScore < 0.38;
  const confBorderline = r.confidenceScore < 0.45;
  const covBorderline = r.overallCoverageScore < 0.35;
  const watchOnly = r.suggestedActionTags.includes("watch_only");

  const statusHandoff =
    r.operatorStatus === "shortlisted" ||
    r.operatorStatus === "contacted_manually" ||
    Boolean(r.manuallyReviewedAt);

  const reasons: string[] = [];
  if (!hasRationale) reasons.push("Missing action rationale");
  if (!hasNext) reasons.push("Missing suggested next move");
  if (covVeryLow) reasons.push("Very low extraction coverage");
  else if (covBorderline) reasons.push("Low extraction coverage");
  if (confVeryLow) reasons.push("Very low model confidence");
  else if (confBorderline) reasons.push("Low model confidence");
  if (watchOnly) reasons.push("Watch-only suggested action (no direct outreach)");
  if (!hasEvidence && r.accessStatus === "public") reasons.push("Missing evidence");
  if (r.hasOperatorFieldOverrides && !overrideReasonsComplete(r)) reasons.push("Incomplete override rationale notes");
  if (!statusHandoff) reasons.push("Not shortlisted, contacted manually, or manually reviewed");

  let handoffReadiness: HandoffReadiness;
  if (!hasRationale || !hasNext || covVeryLow || confVeryLow) {
    handoffReadiness = "not_ready";
  } else if (!hasEvidence && r.accessStatus === "public") {
    handoffReadiness = "review_needed";
  } else if (r.hasOperatorFieldOverrides && !overrideReasonsComplete(r)) {
    handoffReadiness = "review_needed";
  } else if (
    statusHandoff &&
    hasEvidence &&
    hasRationale &&
    hasNext &&
    !confBorderline &&
    !covBorderline &&
    overrideReasonsComplete(r)
  ) {
    handoffReadiness = "ready";
  } else if (statusHandoff || r.opportunityScore >= 0.5) {
    handoffReadiness = "review_needed";
  } else {
    handoffReadiness = "not_ready";
  }

  if (handoffReadiness === "ready") {
    return { handoffReadiness, handoffReadinessReasons: ["Ready for operator handoff"] };
  }

  const uniq = Array.from(new Set(reasons));
  return { handoffReadiness, handoffReadinessReasons: uniq };
}

export function deriveHandoffReadiness(r: LeadAnalysisRow): HandoffReadiness {
  return deriveHandoffReadinessWithReasons(r).handoffReadiness;
}
