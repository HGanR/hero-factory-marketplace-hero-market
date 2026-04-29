import type { FrCase, VaultDocument } from "./vaultTypes";

export type CaseDerivedSignals = {
  hasOverdueDocument: boolean;
  allDocumentsCompleted: boolean;
  caseEscalated: boolean;
  suggestCaseFollowUp: boolean;
  suggestCaseComplete: boolean;
  /** Stricter than suggestCaseComplete: no overdue follow-ups (docs + matter), not escalated. */
  readinessToClose: boolean;
  matterFollowUpOverdue: boolean;
  linkedDocsEscalatedByCase: boolean;
};

export function deriveCaseSignals(c: FrCase, allDocs: VaultDocument[], todayIsoDate: string): CaseDerivedSignals {
  const byId = new Map<string, VaultDocument>();
  for (const d of allDocs) {
    if (d.caseId === c.id || c.documentIds.includes(d.id)) byId.set(d.id, d);
  }
  const linked = [...byId.values()];
  const terminal = (s: VaultDocument["status"]) => s === "completed" || s === "escalated";

  const hasOverdueDocument = linked.some(
    (d) =>
      d.followUpDueAt &&
      d.followUpDueAt < todayIsoDate &&
      !terminal(d.status)
  );

  const allDocumentsCompleted =
    linked.length > 0 && linked.every((d) => d.status === "completed");

  const caseEscalated = c.status === "escalated";
  const linkedDocsEscalatedByCase = caseEscalated;

  const suggestCaseFollowUp =
    hasOverdueDocument && c.status !== "follow_up_due" && c.status !== "completed" && c.status !== "escalated";

  const suggestCaseComplete =
    linked.length > 0 &&
    linked.every((d) => d.status === "completed") &&
    c.status !== "completed";

  const matterFollowUpOverdue =
    c.followUpDueAt != null &&
    c.followUpDueAt < todayIsoDate &&
    c.status !== "completed" &&
    c.status !== "escalated";

  const readinessToClose =
    linked.length > 0 &&
    linked.every((d) => d.status === "completed") &&
    !hasOverdueDocument &&
    !matterFollowUpOverdue &&
    !caseEscalated &&
    c.status !== "completed";

  return {
    hasOverdueDocument,
    allDocumentsCompleted,
    caseEscalated,
    suggestCaseFollowUp,
    suggestCaseComplete,
    readinessToClose,
    matterFollowUpOverdue,
    linkedDocsEscalatedByCase,
  };
}
