import type { RetAgentDraft } from "@/lib/ret/types";

export interface RetDemoPagePayload {
  heroTitle: string;
  heroSubtitle: string;
  propertyDealLabel: string;
  ownerContact: string;
  notesLine: string;
  structureSummary: string[];
  riskSummary: string[];
  jurisdictionSummary: string[];
  escalationItems: string[];
  consultantSummary: string[];
  clientFacingSummary: string[];
  intelligenceFeatures: string[];
  ctaLabel: string;
}

function truthyLabel(flag: boolean, yes: string): string | null {
  return flag ? yes : null;
}

/**
 * Sell-side RET intake → structured demo payload for preview / Site Builder mapping.
 * Shapes fields to match `RetAgentDraft` in this repo (lighter than full RET workspace types).
 */
export function buildRetDemoPayload(draft: RetAgentDraft): RetDemoPagePayload {
  const riskSummary = [
    `Securities / token risk: ${draft.risk.securities}/5`,
    `Lender / covenant risk: ${draft.risk.lender}/5`,
    `Title / recording risk: ${draft.risk.title}/5`,
    truthyLabel(draft.flags.titleClear, "Title reported clear"),
    truthyLabel(draft.flags.lienRecorded, "Lien recorded"),
    truthyLabel(draft.flags.mortgageActive, "Mortgage active"),
  ].filter(Boolean) as string[];

  const structureSummary = [
    draft.structure ? `Holding structure: ${draft.structure}` : "",
    draft.tokenDesign ? `Token design target: ${draft.tokenDesign}` : "",
  ].filter(Boolean);

  const jurisdictionSummary = [draft.jurisdiction.trim() ? `Jurisdiction / notes: ${draft.jurisdiction}` : ""].filter(
    Boolean
  );

  const escalationItems = Object.entries(draft.escalation)
    .filter(([, v]) => v)
    .map(([k]) => k);

  const intelligenceFeatures: string[] = [];

  const notesLine = draft.intake.notes.trim() || "Notes not yet provided.";

  return {
    heroTitle: draft.intake.propertyLabel.trim() || "Property transfer intelligence demo",
    heroSubtitle:
      "A structured transfer, risk, and listing-intelligence preview generated from RET-style intake.",
    propertyDealLabel: draft.intake.propertyLabel.trim() || "Untitled property / deal",
    ownerContact: draft.intake.ownerContact.trim() || "Owner contact not yet provided",
    notesLine,
    structureSummary,
    riskSummary,
    jurisdictionSummary,
    escalationItems,
    consultantSummary: draft.consultantSummary.trim()
      ? [draft.consultantSummary.trim()]
      : ["Consultant summary to be completed."],
    clientFacingSummary: draft.clientSummary.trim()
      ? [draft.clientSummary.trim()]
      : ["Client-facing summary to be completed."],
    intelligenceFeatures,
    ctaLabel: "Open in Site Builder",
  };
}

/** 0–100 heuristic for RET demo UX (aligns preview / tailored thresholds with buyer flow). */
export function retDemoPayloadProgressPercent(payload: RetDemoPagePayload): number {
  let n = 0;
  if (payload.propertyDealLabel.trim() && payload.propertyDealLabel !== "Untitled property / deal") n += 35;
  if (payload.ownerContact.trim() && payload.ownerContact !== "Owner contact not yet provided") n += 20;
  if (payload.notesLine.trim() && payload.notesLine !== "Notes not yet provided.") n += 25;
  if (payload.consultantSummary[0] && !payload.consultantSummary[0].includes("to be completed")) n += 10;
  if (payload.clientFacingSummary[0] && !payload.clientFacingSummary[0].includes("to be completed")) n += 10;
  return Math.min(100, n);
}

export function getRetDemoIntakeProgressPercent(draft: RetAgentDraft): number {
  return retDemoPayloadProgressPercent(buildRetDemoPayload(draft));
}
