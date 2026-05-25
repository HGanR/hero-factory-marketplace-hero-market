/**
 * Executive Admin ↔ real Bentley guided intake (same orchestrator as /ai-revenue-os).
 */

import type { ClientReadinessAnswers } from "@/components/ai-revenue-os/ClientReadinessQuestionnaire";
import {
  applyAnswerForField,
  getGuidedMissingField,
  getWorkflowPhase,
  questionForField,
  structuredGuidedIntakeCompleteForCampaign,
  type BentleyFieldKey,
  type BentleySnapshot,
} from "@/lib/revenue-os/bentley-orchestrator";
import { effectiveIndustryLabelFromSnapshot } from "@/lib/revenue-os/bentley-section-readiness";

export type ExecutiveBentleyIntakeTurnResult =
  | { ok: true; confirm: string; nextQuestion: string | null; phase: string; intakeComplete: boolean }
  | { ok: false; error: string; nextQuestion: string | null };

export function executiveBentleyMissingField(snap: BentleySnapshot): BentleyFieldKey | null {
  return getGuidedMissingField(snap);
}

export function executiveBentleyIntakeComplete(snap: BentleySnapshot): boolean {
  return structuredGuidedIntakeCompleteForCampaign(snap);
}

export function executiveBentleyOpeningQuestion(snap: BentleySnapshot): string {
  const missing = executiveBentleyMissingField(snap);
  if (!missing) {
    return "Guided intake is complete. Say **run pipeline** to execute research through analysis, or ask for **campaign status**.";
  }
  return questionForField(missing);
}

export function executiveBentleyIntakeGreeting(snap: BentleySnapshot): string {
  const industry = effectiveIndustryLabelFromSnapshot(snap);
  const name = snap.businessName?.trim();
  if (executiveBentleyIntakeComplete(snap)) {
    return name
      ? `Bentley campaign mode active for **${name}**${industry ? ` (${industry})` : ""}. Intake is saved — I can run the pipeline or review outputs in the HUD.`
      : "Bentley campaign mode active. Intake is complete — say **run pipeline** when you're ready.";
  }
  const q = executiveBentleyOpeningQuestion(snap);
  return `Understood, Boss. I'm running the real Bentley intake — same questions as AI Revenue OS. ${q}`;
}

/** Apply one voice/text answer to the current missing guided field. */
export function applyExecutiveBentleyIntakeAnswer(
  snap: BentleySnapshot,
  message: string,
): ExecutiveBentleyIntakeTurnResult & { patch?: Partial<BentleySnapshot>; questionnairePatch?: Partial<ClientReadinessAnswers> } {
  const missing = executiveBentleyMissingField(snap);
  if (!missing) {
    return {
      ok: false,
      error: "Intake is already complete.",
      nextQuestion: null,
    };
  }

  const applied = applyAnswerForField(missing, message);
  if ("error" in applied) {
    return {
      ok: false,
      error: applied.error,
      nextQuestion: questionForField(missing),
    };
  }

  const merged: BentleySnapshot = { ...snap, ...applied.patch };
  const nextMissing = getGuidedMissingField(merged);
  const phase = getWorkflowPhase(merged);
  const intakeComplete = structuredGuidedIntakeCompleteForCampaign(merged);

  return {
    ok: true,
    confirm: applied.confirm,
    nextQuestion: nextMissing ? questionForField(nextMissing) : null,
    phase,
    intakeComplete,
    patch: applied.patch,
    questionnairePatch: applied.questionnairePatch,
  };
}
