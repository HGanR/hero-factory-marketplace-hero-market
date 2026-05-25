import type {
  NeuroAssignedAgent,
  NeuroDocumentStatus,
  NeuroSubjectArea,
} from "@/lib/executive-agent/neuro/neuro-types";

/** Subjects that require legal/financial review disclaimer on source-backed answers. */
export const NEURO_SENSITIVE_SUBJECTS: NeuroSubjectArea[] = [
  "TRUST",
  "TAX",
  "CONSUMER_LAW",
  "FINANCIAL_READINESS",
  "ACCOUNTING",
];

export function neuroDisclaimerForSubject(subject: NeuroSubjectArea | null | undefined): string | null {
  if (!subject || !NEURO_SENSITIVE_SUBJECTS.includes(subject)) return null;
  return (
    "NEURO sources are reference materials only — not legal, tax, or financial advice. " +
    "Have qualified counsel or a licensed professional review before acting."
  );
}

export const NEURO_NO_SOURCE_MESSAGE =
  "Boss, I do not have a NEURO source for that yet.";

export function neuroSourceBackedPreamble(hitCount: number, strongestFile?: string): string {
  if (hitCount <= 0) return NEURO_NO_SOURCE_MESSAGE;
  if (strongestFile) {
    return `I found ${hitCount} NEURO source${hitCount === 1 ? "" : "s"}. Strongest match: ${strongestFile}.`;
  }
  return `I found ${hitCount} NEURO source${hitCount === 1 ? "" : "s"} for that query.`;
}

export function isNeuroSensitiveSearch(subject?: NeuroSubjectArea | null, agent?: NeuroAssignedAgent | null): boolean {
  if (subject && NEURO_SENSITIVE_SUBJECTS.includes(subject)) return true;
  if (agent === "JARVA" || agent === "ELEANOR") return true;
  return false;
}
