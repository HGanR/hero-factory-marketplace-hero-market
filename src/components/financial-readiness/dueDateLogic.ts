import type { VaultDocumentType } from "./vaultTypes";

/** Calendar-day follow-ups from generation time (local date math). */
export function computeFollowUpDueAt(
  type: VaultDocumentType,
  createdAtIso: string
): string | null {
  const base = new Date(createdAtIso);
  if (Number.isNaN(base.getTime())) return null;
  const days =
    type === "bureau_dispute"
      ? 30
      : type === "creditor_verification"
        ? 30
        : type === "debt_validation"
          ? 14
          : type === "cease_communication"
            ? 14
            : 30;
  base.setDate(base.getDate() + days);
  return base.toISOString().slice(0, 10);
}

/** Monitoring checkpoint after validation / cease (can differ from investigation window). */
export function computeMonitoringCheckpoint(createdAtIso: string, days = 14): string | null {
  const base = new Date(createdAtIso);
  if (Number.isNaN(base.getTime())) return null;
  base.setDate(base.getDate() + days);
  return base.toISOString().slice(0, 10);
}
