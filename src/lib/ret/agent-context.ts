import type { RetAgentDraft } from "@/lib/ret/types";

/**
 * Curated, agent-safe snapshot of RET draft for widget `context.retSnapshot`.
 * Extend as the RET form grows; avoid PII beyond what the user already typed in-app.
 */
export function buildRetAgentContext(draft: RetAgentDraft): Record<string, unknown> {
  const escalationOn = Object.entries(draft.escalation)
    .filter(([, v]) => v)
    .map(([k]) => k);

  return {
    pageType: "ret",
    propertyLabel: draft.intake.propertyLabel.trim() || undefined,
    ownerContactPresent: draft.intake.ownerContact.trim().length > 0,
    intakeNotesPreview: draft.intake.notes.trim().slice(0, 2000) || undefined,
    flags: draft.flags,
    structure: draft.structure,
    tokenDesign: draft.tokenDesign,
    risk: draft.risk,
    jurisdictionNotes: draft.jurisdiction.trim().slice(0, 4000) || undefined,
    consultantSummaryPreview: draft.consultantSummary.trim().slice(0, 2000) || undefined,
    clientSummaryPreview: draft.clientSummary.trim().slice(0, 2000) || undefined,
    escalationActive: escalationOn,
  };
}
