/**
 * Human-readable labels for Jarva intake dot-path keys (consultant UI).
 */

const LABELS: Record<string, string> = {
  matterLabel: "Matter label",
  objectives: "Objectives",
  governingState: "Governing / situs state",
  trustName: "Trust name (working)",
  "grantor.name": "Grantor name",
  "grantor.email": "Grantor email",
  "grantor.phone": "Grantor phone",
  "grantor.state": "Grantor state",
  "grantor.addressLine1": "Grantor address",
  "grantor.city": "Grantor city",
  "grantor.postalCode": "Grantor postal code",
  "trustee.name": "Trustee name",
  "trustee.email": "Trustee email",
  "trustee.phone": "Trustee phone",
  beneficiariesSummary: "Beneficiaries (summary)",
  successorTrusteeNote: "Successor trustees",
  pourOverWillNeeded: "Pour-over will intent",
  jurisdictionAmbiguityNote: "Jurisdiction notes",
  assetScheduleNotesDraft: "Asset / schedule notes",
  spiritualOrEcclesiasticalNotes: "Spiritual / ecclesiastical notes",
  securitiesIntentNotes: "Securities / capital notes",
  "firm.name": "Firm name",
  "firm.email": "Firm email",
  "firm.phone": "Firm phone",
  "firm.address": "Firm address",
};

export function jarvaFieldKeyToLabel(fieldKey: string): string {
  return LABELS[fieldKey] ?? fieldKey.replace(/\./g, " · ");
}

export function formatJarvaQuestionCategory(category: string): string {
  return category.replace(/_/g, " ");
}

/** Dot-path lookup on a plain intake object (same shape as saved Jarva intake JSON). */
export function getJarvaIntakeValueForFieldKey(
  intake: Record<string, unknown>,
  fieldKey: string
): string {
  const segments = fieldKey.split(".");
  let cur: unknown = intake;
  for (const seg of segments) {
    if (cur && typeof cur === "object" && seg in (cur as object)) {
      cur = (cur as Record<string, unknown>)[seg];
    } else {
      return "—";
    }
  }
  if (cur === undefined || cur === null) return "—";
  if (typeof cur === "boolean") return cur ? "Yes" : "No";
  const s = typeof cur === "string" ? cur.trim() : String(cur);
  return s || "—";
}

/**
 * Prefer in-progress form values; if the UI omits a path, fall back to the last saved intake snapshot
 * so explainability can show chat-extracted fields that are not on the short form.
 */
export function getJarvaIntakeValueForFieldKeyPreferForm(
  formIntake: Record<string, unknown>,
  savedIntake: Record<string, unknown> | null | undefined,
  fieldKey: string
): string {
  const fromForm = getJarvaIntakeValueForFieldKey(formIntake, fieldKey);
  if (fromForm !== "—") return fromForm;
  if (savedIntake && typeof savedIntake === "object") {
    return getJarvaIntakeValueForFieldKey(savedIntake, fieldKey);
  }
  return "—";
}

export function formatJarvaSourceApplyKind(kind: string | undefined): string | null {
  if (!kind) return null;
  const map: Record<string, string> = {
    chat_extraction: "Chat extraction",
    manual_save: "Manual save",
    auto_apply: "Auto-apply",
    manual_apply: "Manual apply",
  };
  return map[kind] ?? kind.replace(/_/g, " ");
}

/** Tailwind classes for next-question category pills (consultant chat strip). */
export function jarvaQuestionCategoryBadgeClass(category: string): string {
  if (category === "hard_blocker") return "border border-amber-700/60 bg-amber-950/70 text-amber-100";
  if (category === "apply_required") return "border border-cyan-700/50 bg-cyan-950/50 text-cyan-100";
  if (category === "packet_quality") return "border border-slate-600 bg-slate-800/80 text-slate-200";
  return "border border-slate-600 bg-slate-800/60 text-slate-300";
}

export function jarvaConfidenceBadgeClass(confidence: string | undefined): string {
  if (confidence === "high") return "border border-emerald-700/50 bg-emerald-950/70 text-emerald-100";
  if (confidence === "medium") return "border border-amber-700/50 bg-amber-950/60 text-amber-100";
  if (confidence === "low") return "border border-slate-600 bg-slate-800/80 text-slate-200";
  return "border border-slate-600 bg-slate-800/60 text-slate-400";
}
