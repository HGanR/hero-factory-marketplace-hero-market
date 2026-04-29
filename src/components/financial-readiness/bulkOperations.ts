/**
 * Bulk vault/matter operations with single activity log + undo via inverse dispatches.
 */

import type { FinancialReadinessAction } from "./state";
import type { FrCase, VaultDocument } from "./vaultTypes";
import { snoozeFromDueOrToday, uniqTag } from "./followUpHelpers";
import type { DocumentLifecycleStatus } from "./vaultTypes";

export type BulkUndo = {
  label: string;
  apply: (dispatch: (a: FinancialReadinessAction) => void) => void;
};

export const BULK_COMPLETE_CONFIRM_MIN = 5;

export function vaultBulkMarkCompleted(
  dispatch: (a: FinancialReadinessAction) => void,
  docs: VaultDocument[],
  payloadLines: { documentId: string; from: DocumentLifecycleStatus; to: DocumentLifecycleStatus }[]
): BulkUndo {
  for (const d of docs) {
    dispatch({ type: "documents/patch", id: d.id, patch: { status: "completed" }, skipActivity: true });
  }
  dispatch({
    type: "activities/append",
    entry: {
      caseId: docs[0]?.caseId ?? null,
      documentId: null,
      kind: "bulk_vault",
      summary: `Bulk: mark ${docs.length} letter(s) completed`,
      payload: { operation: "mark_completed", count: docs.length, items: payloadLines },
    },
  });
  return {
    label: "mark completed",
    apply: (d) => {
      for (const x of docs) {
        d({
          type: "documents/patch",
          id: x.id,
          patch: { status: x.status },
          skipActivity: true,
        });
      }
      d({
        type: "activities/append",
        entry: {
          caseId: docs[0]?.caseId ?? null,
          documentId: null,
          kind: "bulk_undo",
          summary: `Undo bulk: restored status for ${docs.length} letter(s)`,
          payload: { restored: "mark_completed" },
        },
      });
    },
  };
}

export function vaultBulkSnooze(
  dispatch: (a: FinancialReadinessAction) => void,
  docs: VaultDocument[],
  today: string,
  days: number
): BulkUndo {
  const before: { id: string; followUpDueAt: string | null }[] = docs.map((d) => ({
    id: d.id,
    followUpDueAt: d.followUpDueAt,
  }));
  for (const d of docs) {
    const followUpDueAt = snoozeFromDueOrToday(d.followUpDueAt, days, today);
    dispatch({ type: "documents/patch", id: d.id, patch: { followUpDueAt }, skipActivity: true });
  }
  dispatch({
    type: "activities/append",
    entry: {
      caseId: docs[0]?.caseId ?? null,
      documentId: null,
      kind: "bulk_vault",
      summary: `Bulk: snooze follow-up +${days}d (${docs.length} letter(s))`,
      payload: { operation: "snooze", days, before },
    },
  });
  return {
    label: "snooze",
    apply: (d) => {
      for (const x of before) {
        d({
          type: "documents/patch",
          id: x.id,
          patch: { followUpDueAt: x.followUpDueAt },
          skipActivity: true,
        });
      }
      d({
        type: "activities/append",
        entry: {
          caseId: docs[0]?.caseId ?? null,
          documentId: null,
          kind: "bulk_undo",
          summary: `Undo bulk: restored follow-up dates (${docs.length})`,
          payload: { restored: "snooze" },
        },
      });
    },
  };
}

export function vaultBulkAddTag(
  dispatch: (a: FinancialReadinessAction) => void,
  docs: VaultDocument[],
  tag: string
): BulkUndo {
  const before = docs.map((d) => ({ id: d.id, tags: [...d.tags] }));
  for (const d of docs) {
    dispatch({
      type: "documents/patch",
      id: d.id,
      patch: { tags: uniqTag(d.tags, tag) },
      skipActivity: true,
    });
  }
  dispatch({
    type: "activities/append",
    entry: {
      caseId: docs[0]?.caseId ?? null,
      documentId: null,
      kind: "bulk_vault",
      summary: `Bulk: add tag “${tag}” (${docs.length} letter(s))`,
      payload: { operation: "add_tag", tag, before },
    },
  });
  return {
    label: "add tag",
    apply: (d) => {
      for (const x of before) {
        d({ type: "documents/patch", id: x.id, patch: { tags: x.tags }, skipActivity: true });
      }
      d({
        type: "activities/append",
        entry: {
          caseId: docs[0]?.caseId ?? null,
          documentId: null,
          kind: "bulk_undo",
          summary: `Undo bulk: restored tags (${docs.length})`,
          payload: { restored: "add_tag" },
        },
      });
    },
  };
}

export function vaultBulkAssign(
  dispatch: (a: FinancialReadinessAction) => void,
  docs: VaultDocument[],
  newCaseId: string
): BulkUndo {
  const before = docs.map((d) => ({ id: d.id, caseId: d.caseId }));
  for (const d of docs) {
    dispatch({
      type: "documents/assignCase",
      documentId: d.id,
      caseId: newCaseId,
      skipActivity: true,
    });
  }
  dispatch({
    type: "activities/append",
    entry: {
      caseId: newCaseId,
      documentId: null,
      kind: "bulk_vault",
      summary: `Bulk: assign ${docs.length} letter(s) to matter`,
      payload: { operation: "assign", newCaseId, before },
    },
  });
  return {
    label: "assign to matter",
    apply: (d) => {
      for (const x of before) {
        d({
          type: "documents/assignCase",
          documentId: x.id,
          caseId: x.caseId,
          skipActivity: true,
        });
      }
      d({
        type: "activities/append",
        entry: {
          caseId: before[0]?.caseId ?? null,
          documentId: null,
          kind: "bulk_undo",
          summary: `Undo bulk: restored matter assignment (${docs.length})`,
          payload: { restored: "assign" },
        },
      });
    },
  };
}

export function casesBulkMarkCompleted(
  dispatch: (a: FinancialReadinessAction) => void,
  cases: FrCase[],
  payloadLines: { caseId: string; from: DocumentLifecycleStatus; to: DocumentLifecycleStatus }[]
): BulkUndo {
  for (const c of cases) {
    dispatch({ type: "cases/patch", id: c.id, patch: { status: "completed" }, skipActivity: true });
  }
  dispatch({
    type: "activities/append",
    entry: {
      caseId: cases[0]?.id ?? null,
      documentId: null,
      kind: "bulk_cases",
      summary: `Bulk: mark ${cases.length} matter(s) completed`,
      payload: { operation: "mark_completed", count: cases.length, items: payloadLines },
    },
  });
  return {
    label: "mark completed",
    apply: (d) => {
      for (const c of cases) {
        d({ type: "cases/patch", id: c.id, patch: { status: c.status }, skipActivity: true });
      }
      d({
        type: "activities/append",
        entry: {
          caseId: cases[0]?.id ?? null,
          documentId: null,
          kind: "bulk_undo",
          summary: `Undo bulk: restored matter status (${cases.length})`,
          payload: { restored: "mark_completed" },
        },
      });
    },
  };
}

export function casesBulkSnooze(
  dispatch: (a: FinancialReadinessAction) => void,
  cases: FrCase[],
  today: string,
  days: number
): BulkUndo {
  const before = cases.map((c) => ({ id: c.id, followUpDueAt: c.followUpDueAt }));
  for (const c of cases) {
    const followUpDueAt = snoozeFromDueOrToday(c.followUpDueAt, days, today);
    dispatch({ type: "cases/patch", id: c.id, patch: { followUpDueAt }, skipActivity: true });
  }
  dispatch({
    type: "activities/append",
    entry: {
      caseId: cases[0]?.id ?? null,
      documentId: null,
      kind: "bulk_cases",
      summary: `Bulk: snooze matter follow-up +${days}d (${cases.length})`,
      payload: { operation: "snooze", days, before },
    },
  });
  return {
    label: "snooze",
    apply: (d) => {
      for (const x of before) {
        d({
          type: "cases/patch",
          id: x.id,
          patch: { followUpDueAt: x.followUpDueAt },
          skipActivity: true,
        });
      }
      d({
        type: "activities/append",
        entry: {
          caseId: cases[0]?.id ?? null,
          documentId: null,
          kind: "bulk_undo",
          summary: `Undo bulk: restored matter follow-ups (${cases.length})`,
          payload: { restored: "snooze" },
        },
      });
    },
  };
}

export function casesBulkAddTag(
  dispatch: (a: FinancialReadinessAction) => void,
  cases: FrCase[],
  tag: string
): BulkUndo {
  const before = cases.map((c) => ({ id: c.id, tags: [...c.tags] }));
  for (const c of cases) {
    dispatch({
      type: "cases/patch",
      id: c.id,
      patch: { tags: uniqTag(c.tags, tag) },
      skipActivity: true,
    });
  }
  dispatch({
    type: "activities/append",
    entry: {
      caseId: cases[0]?.id ?? null,
      documentId: null,
      kind: "bulk_cases",
      summary: `Bulk: add tag “${tag}” (${cases.length} matter(s))`,
      payload: { operation: "add_tag", tag, before },
    },
  });
  return {
    label: "add tag",
    apply: (d) => {
      for (const x of before) {
        d({ type: "cases/patch", id: x.id, patch: { tags: x.tags }, skipActivity: true });
      }
      d({
        type: "activities/append",
        entry: {
          caseId: cases[0]?.id ?? null,
          documentId: null,
          kind: "bulk_undo",
          summary: `Undo bulk: restored matter tags (${cases.length})`,
          payload: { restored: "add_tag" },
        },
      });
    },
  };
}
