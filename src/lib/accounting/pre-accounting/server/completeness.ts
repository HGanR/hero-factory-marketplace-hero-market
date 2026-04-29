/**
 * Evidence completeness labels — operational / preparatory, not filing conclusions.
 */

export type CompletenessLabel =
  | "not_started"
  | "partial"
  | "substantially_complete"
  | "ready_for_review"
  | "ready_for_handoff";

function labelFromPercent(p: number): CompletenessLabel {
  if (p <= 0) return "not_started";
  if (p < 40) return "partial";
  if (p < 75) return "substantially_complete";
  if (p < 95) return "ready_for_review";
  return "ready_for_handoff";
}

function parseCloseout(raw: string | null | undefined): Record<string, boolean> {
  if (!raw) return {};
  try {
    const j = JSON.parse(raw) as unknown;
    if (j && typeof j === "object") return j as Record<string, boolean>;
  } catch {
    /* ignore */
  }
  return {};
}

/** Per-quarter completeness from workflow + optional closeout checklist JSON. */
export function computeQuarterCompleteness(
  quarterRow: {
    quarterLabel: string;
    status: string;
    checklistJson: string | null;
    closeoutJson: string | null;
  }
): { percent: number; label: CompletenessLabel; openIssues: number; blockers: number } {
  let checklist: Record<string, boolean> = {};
  try {
    if (quarterRow.checklistJson) {
      const c = JSON.parse(quarterRow.checklistJson) as Record<string, boolean>;
      checklist = { ...checklist, ...c };
    }
  } catch {
    /* ignore */
  }
  const closeout = parseCloseout(quarterRow.closeoutJson);
  const merged = { ...checklist, ...closeout };
  const keys = Object.keys(merged);
  const done = keys.filter((k) => merged[k]).length;
  const total = Math.max(keys.length, 3);
  let percent = keys.length ? Math.round((done / total) * 100) : 0;
  if (quarterRow.status === "ready_for_preparer" || quarterRow.status === "reviewed") {
    percent = Math.max(percent, 85);
  }
  const openIssues = keys.filter((k) => !merged[k]).length;
  return {
    percent,
    label: labelFromPercent(percent),
    openIssues,
    blockers: 0,
  };
}

/** Single form row completeness. */
export function computeFormCompleteness(row: {
  missingSupportJson: string | null;
  attachedDocumentIdsJson: string | null;
  supportGapStatus: string | null;
  reviewerStatus: string | null;
}): { percent: number; label: CompletenessLabel } {
  let missing: string[] = [];
  try {
    if (row.missingSupportJson) {
      const j = JSON.parse(row.missingSupportJson) as unknown;
      if (Array.isArray(j)) missing = j.filter((x): x is string => typeof x === "string");
    }
  } catch {
    /* ignore */
  }
  let attached = 0;
  try {
    if (row.attachedDocumentIdsJson) {
      const j = JSON.parse(row.attachedDocumentIdsJson) as unknown;
      if (Array.isArray(j)) attached = j.filter((x) => typeof x === "number").length;
    }
  } catch {
    /* ignore */
  }
  const sg = row.supportGapStatus ?? "open";
  const waivedOrResolved = sg === "waived" || sg === "resolved";
  let percent = 40;
  if (missing.length === 0 || waivedOrResolved) percent = 90;
  else if (attached > 0) percent = 55;
  if (row.reviewerStatus === "cleared") percent = Math.max(percent, 95);
  return { percent, label: labelFromPercent(percent) };
}

export type WorkspaceCompletenessSnapshot = {
  quarters: Record<string, ReturnType<typeof computeQuarterCompleteness> & { closeoutStatus: string }>;
  forms: Record<string, { percent: number; label: CompletenessLabel }>;
  handoff: { percent: number; label: CompletenessLabel; notes: string[] };
};

export function buildWorkspaceCompletenessSnapshot(input: {
  quarterlyWorkflows: Array<{
    quarterLabel: string;
    status: string;
    checklistJson: string | null;
    closeoutJson: string | null;
  }>;
  formCandidates: Array<{
    formCode: string;
    missingSupportJson: string | null;
    attachedDocumentIdsJson: string | null;
    supportGapStatus: string | null;
    reviewerStatus: string | null;
  }>;
  gatePassed: boolean;
  /** Optional: merge open review items into quarter blocker / issue counts */
  reviewItems?: Array<{
    sourceType: string;
    sourceId: string | null;
    severity: string;
    status: string;
  }>;
}): WorkspaceCompletenessSnapshot {
  const items = input.reviewItems ?? [];
  const quarters: WorkspaceCompletenessSnapshot["quarters"] = {};
  for (const q of input.quarterlyWorkflows) {
    const c = computeQuarterCompleteness(q);
    const openStatuses = new Set(["open", "in_progress", "waiting_on_client"]);
    const quarterReview = items.filter(
      (r) =>
        r.sourceType === "incomplete_quarter" &&
        r.sourceId === q.quarterLabel &&
        openStatuses.has(r.status)
    );
    const blockerExtra = quarterReview.filter((r) => r.severity === "blocker").length;
    quarters[q.quarterLabel] = {
      ...c,
      blockers: c.blockers + blockerExtra,
      openIssues: c.openIssues + quarterReview.length,
      closeoutStatus: c.label.replace(/_/g, " "),
    };
  }

  const forms: WorkspaceCompletenessSnapshot["forms"] = {};
  for (const f of input.formCandidates) {
    forms[f.formCode] = computeFormCompleteness(f);
  }

  const formPercents = Object.values(forms).map((x) => x.percent);
  const quarterPercents = Object.values(quarters).map((x) => x.percent);
  const avg =
    [...formPercents, ...quarterPercents].length > 0
      ? Math.round(
          [...formPercents, ...quarterPercents].reduce((a, b) => a + b, 0) /
            [...formPercents, ...quarterPercents].length
        )
      : 0;
  let handoffPercent = avg;
  if (input.gatePassed) handoffPercent = Math.max(handoffPercent, 90);
  const notes: string[] = [];
  if (!input.gatePassed) notes.push("Readiness gate reports blockers — resolve or use explicit override.");

  return {
    quarters,
    forms,
    handoff: {
      percent: handoffPercent,
      label: labelFromPercent(handoffPercent),
      notes,
    },
  };
}
