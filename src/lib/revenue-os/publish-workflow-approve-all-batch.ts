/**
 * Deterministic bulk “approve all” execution model (publish workflow review).
 */

import type { RevenueOsPublishWorkflowRow } from "@/lib/revenue-os/publish-workflow-review-types";

export type ApproveAllPatchWriteOutcome =
  | { staleRecovered: true }
  | { staleRecovered: false; idempotent: boolean };

export type ApproveAllBatchResult = {
  attemptedCount: number;
  succeededCount: number;
  idempotentCount: number;
  staleStoppedAtPostId: string | null;
  /** Targets not PATCHed because the loop stopped early (stale), in original order. */
  remainingCount: number;
  /** Post ids that received a fresh approval write this run. */
  freshApprovedPostIds: string[];
  /** Post ids that were already approved (idempotent PATCH). */
  idempotentPostIds: string[];
};

export type ApproveAllPatchRowFn = (
  row: RevenueOsPublishWorkflowRow
) => Promise<ApproveAllPatchWriteOutcome>;

/**
 * Sequentially PATCH each target in array order. Stale stops the batch; idempotent rows count but do not stop.
 */
export async function executeApproveAllBatch(
  targets: RevenueOsPublishWorkflowRow[],
  patchRow: ApproveAllPatchRowFn
): Promise<ApproveAllBatchResult> {
  let succeededCount = 0;
  let idempotentCount = 0;
  let staleStoppedAtPostId: string | null = null;
  let attemptedCount = 0;
  const freshApprovedPostIds: string[] = [];
  const idempotentPostIds: string[] = [];

  for (const row of targets) {
    attemptedCount += 1;
    const out = await patchRow(row);
    if (out.staleRecovered) {
      staleStoppedAtPostId = row.postId;
      break;
    }
    if (out.idempotent) {
      idempotentCount += 1;
      idempotentPostIds.push(row.postId);
    } else {
      succeededCount += 1;
      freshApprovedPostIds.push(row.postId);
    }
  }

  const remainingCount =
    staleStoppedAtPostId != null ? Math.max(0, targets.length - attemptedCount) : 0;

  return {
    attemptedCount,
    succeededCount,
    idempotentCount,
    staleStoppedAtPostId,
    remainingCount,
    freshApprovedPostIds,
    idempotentPostIds,
  };
}

/** User-facing copy after approve-all (production). Stale path assumes recovery toast already shown. */
export function formatApproveAllBatchUserMessage(batch: ApproveAllBatchResult): {
  variant: "success" | "message";
  text: string;
} {
  if (batch.staleStoppedAtPostId) {
    const parts: string[] = [];
    if (batch.succeededCount > 0) parts.push(`Approved ${batch.succeededCount} post(s).`);
    if (batch.idempotentCount > 0) parts.push(`${batch.idempotentCount} were already approved.`);
    if (batch.remainingCount > 0) {
      parts.push(
        `${batch.remainingCount} post(s) still need approval — click Approve all again to continue.`
      );
    }
    return {
      variant: "message",
      text: parts.length ? parts.join(" ") : "List refreshed — click Approve all again to continue.",
    };
  }
  if (batch.succeededCount === 0 && batch.idempotentCount === 0) {
    return { variant: "message", text: "No rows needed approval." };
  }
  let text = batch.succeededCount > 0 ? `Approved ${batch.succeededCount} row(s).` : "";
  if (batch.idempotentCount > 0) {
    text += (text ? " " : "") + `${batch.idempotentCount} were already approved.`;
  }
  return { variant: "success", text: text.trim() };
}

/** Compact one-line summary for persistent panel UI (production). */
export function formatApproveAllBatchPersistentSummary(batch: ApproveAllBatchResult): string {
  const parts: string[] = [];
  if (batch.succeededCount > 0) {
    parts.push(`${batch.succeededCount} newly approved`);
  }
  if (batch.idempotentCount > 0) {
    parts.push(`${batch.idempotentCount} already approved (no change)`);
  }
  if (batch.staleStoppedAtPostId) {
    parts.push("Stopped: row was out of date (list refreshed)");
    if (batch.remainingCount > 0) {
      parts.push(`${batch.remainingCount} not processed — run Approve all again`);
    }
  }
  if (parts.length === 0 && batch.attemptedCount === 0) {
    return "Last bulk approve: —";
  }
  if (parts.length === 0) {
    return "Last bulk approve: no changes.";
  }
  return `Last bulk approve: ${parts.join(" · ")}`;
}

export type BulkApproveRowHighlight = {
  freshApprovedPostIds: string[];
  idempotentPostIds: string[];
};

/** Which subtle highlight to apply to a workflow row after the last bulk approve. */
export function rowBulkApproveHighlightKind(
  postId: string,
  highlight: BulkApproveRowHighlight | null
): "fresh" | "idempotent" | null {
  if (!highlight) return null;
  if (highlight.freshApprovedPostIds.includes(postId)) return "fresh";
  if (highlight.idempotentPostIds.includes(postId)) return "idempotent";
  return null;
}
