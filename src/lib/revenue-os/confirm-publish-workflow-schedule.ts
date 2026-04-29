/**
 * Plan bulk application of suggested schedule times from review rows (pure; no I/O).
 */

import type { RevenueOsPublishWorkflowRow } from "@/lib/revenue-os/publish-workflow-review-types";

export type ConfirmPublishWorkflowSchedulePatch = {
  postId: string;
  scheduledAtIso: string;
  /** When true, caller should send scheduledPublishSourceHint: bentley_sequence_apply */
  useBentleyAuditSource: boolean;
};

export type ConfirmPublishWorkflowScheduleResult = {
  patches: ConfirmPublishWorkflowSchedulePatch[];
  appliedCount: number;
  skippedCount: number;
  conflictCount: number;
  skipped: { postId: string; reason: string }[];
};

function normIso(s: string | null | undefined): string | null {
  if (!s?.trim()) return null;
  const t = new Date(s).getTime();
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
}

/**
 * Build safe PATCH payloads: set scheduledAt from suggestion only when allowed.
 */
export function confirmPublishWorkflowSchedule(args: {
  rows: RevenueOsPublishWorkflowRow[];
  /** When true, rows with actualScheduledAt differing from suggested may be patched. */
  confirmOverwrite: boolean;
  /** If true, skip rows with advisory conflicts (e.g. “suggestion not confirmed”). Default false — apply still runs for those. */
  skipAdvisoryConflicts?: boolean;
}): ConfirmPublishWorkflowScheduleResult {
  const patches: ConfirmPublishWorkflowSchedulePatch[] = [];
  const skipped: { postId: string; reason: string }[] = [];
  let conflictCount = 0;

  for (const row of args.rows) {
    const suggested = normIso(row.suggestedScheduledAt ?? undefined);
    if (!suggested) {
      skipped.push({ postId: row.postId, reason: "No suggested scheduled time." });
      continue;
    }

    if (row.hasConflict && row.conflictSeverity === "blocking") {
      conflictCount += 1;
      skipped.push({
        postId: row.postId,
        reason: row.conflictReason ?? "Blocking conflict — skipped.",
      });
      continue;
    }

    if (args.skipAdvisoryConflicts && row.hasConflict && row.conflictSeverity === "advisory") {
      skipped.push({
        postId: row.postId,
        reason: row.conflictReason ?? "Advisory conflict — skipped (accept non-conflicting only).",
      });
      continue;
    }

    const actual = normIso(row.actualScheduledAt ?? undefined);
    if (!actual) {
      patches.push({ postId: row.postId, scheduledAtIso: suggested, useBentleyAuditSource: true });
      continue;
    }

    if (actual === suggested) {
      skipped.push({ postId: row.postId, reason: "Already scheduled at suggested time (idempotent)." });
      continue;
    }

    if (!args.confirmOverwrite) {
      conflictCount += 1;
      skipped.push({
        postId: row.postId,
        reason: "Existing scheduledAt differs — confirm overwrite to replace.",
      });
      continue;
    }

    patches.push({ postId: row.postId, scheduledAtIso: suggested, useBentleyAuditSource: true });
  }

  return {
    patches,
    appliedCount: patches.length,
    skippedCount: skipped.length,
    conflictCount,
    skipped,
  };
}

/**
 * Accept **only** rows that have no conflict at all (strict non-conflicting path).
 */
export function confirmPublishWorkflowScheduleNonConflicting(args: {
  rows: RevenueOsPublishWorkflowRow[];
  confirmOverwrite: boolean;
}): ConfirmPublishWorkflowScheduleResult {
  const strictRows = args.rows.filter((r) => !r.hasConflict);
  return confirmPublishWorkflowSchedule({
    rows: strictRows,
    confirmOverwrite: args.confirmOverwrite,
    skipAdvisoryConflicts: false,
  });
}
