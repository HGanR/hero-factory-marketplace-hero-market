import type { DocumentLifecycleStatus, VaultDocumentType } from "./vaultTypes";

const STATUS_LABELS: Record<DocumentLifecycleStatus, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  awaiting_response: "Awaiting response",
  follow_up_due: "Follow-up due",
  completed: "Completed",
  escalated: "Escalated",
};

const DOC_LABELS: Record<VaultDocumentType, string> = {
  bureau_dispute: "Bureau dispute",
  creditor_verification: "Creditor verification",
  debt_validation: "Debt validation",
  cease_communication: "Cease communication",
};

export function statusLabel(s: DocumentLifecycleStatus): string {
  return STATUS_LABELS[s] ?? s;
}

export function vaultDocumentLabel(t: VaultDocumentType): string {
  return DOC_LABELS[t] ?? t;
}
