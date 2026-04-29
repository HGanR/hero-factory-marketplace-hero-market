/**
 * Client-side helpers for recovering from PATCH 409 STALE_REVIEW (publish workflow).
 */

import type { RevenueOsPublishApprovalStatus } from "@/lib/revenue-os/publish-approval-types";

export type StaleReviewErrorBody = {
  error?: string;
  message?: string;
  staleCause?: string;
};

export function isStaleReviewConflictResponse(status: number, body: unknown): body is StaleReviewErrorBody {
  if (status !== 409) return false;
  if (!body || typeof body !== "object") return false;
  return (body as StaleReviewErrorBody).error === "STALE_REVIEW";
}

/** User-facing copy (non-debug). */
export function staleReviewRecoveryToastMessage(body: StaleReviewErrorBody): string {
  const base =
    typeof body.message === "string" && body.message.trim()
      ? body.message.trim()
      : "This post or its approval state changed since you loaded it.";
  return `${base} Your list has been refreshed with the latest data — review the row and try again if needed.`;
}

export type StaleRecoveryDebugSummary = {
  postId: string;
  staleCause?: string;
  expectedApprovalStatusBefore: RevenueOsPublishApprovalStatus | undefined;
  postRowUpdatedAtBefore: string | null;
  latestApprovalStatus: RevenueOsPublishApprovalStatus | undefined;
  postRowUpdatedAtAfter: string | null;
};

/**
 * Build `approvalReviewSnapshot` fields from a workflow row (same rules as the panel).
 */
export function buildApprovalReviewSnapshotFromWorkflowRow(row: {
  approvalStatus?: RevenueOsPublishApprovalStatus;
  postRowUpdatedAt?: string | null;
  currentApprovalStepIndex?: number | null;
}):
  | {
      expectedApprovalStatus: RevenueOsPublishApprovalStatus;
      postUpdatedAt: string;
      expectedApprovalStepIndex?: number;
    }
  | null {
  if (row.approvalStatus == null || !row.postRowUpdatedAt?.trim()) return null;
  const snap: {
    expectedApprovalStatus: RevenueOsPublishApprovalStatus;
    postUpdatedAt: string;
    expectedApprovalStepIndex?: number;
  } = {
    expectedApprovalStatus: row.approvalStatus,
    postUpdatedAt: row.postRowUpdatedAt.trim(),
  };
  if (
    row.currentApprovalStepIndex != null &&
    Number.isFinite(row.currentApprovalStepIndex)
  ) {
    snap.expectedApprovalStepIndex = row.currentApprovalStepIndex;
  }
  return snap;
}

/** Row shape needed to compare before/after refresh (workflow review). */
export type StaleRecoveryWorkflowRowRef = {
  postId: string;
  approvalStatus?: RevenueOsPublishApprovalStatus;
  postRowUpdatedAt?: string | null;
};

export type StaleRecoveryRefreshedSummary = {
  rows: StaleRecoveryWorkflowRowRef[];
};

/**
 * After a 409 STALE_REVIEW, run `refresh()` and build optional debug diff.
 * Caller must show `staleReviewRecoveryToastMessage` (and any other UX) before/after.
 */
export async function finalizeStaleReviewWorkflowRefresh(args: {
  responseBody: StaleReviewErrorBody;
  postId: string;
  rowBefore?: StaleRecoveryWorkflowRowRef;
  refresh: () => Promise<StaleRecoveryRefreshedSummary | null>;
  debug: boolean;
}): Promise<StaleRecoveryDebugSummary | null> {
  const rev = await args.refresh();
  if (!args.debug || !args.rowBefore || !rev?.rows?.length) return null;
  const nrow = rev.rows.find((x) => x.postId === args.postId);
  if (!nrow) return null;
  return {
    postId: args.postId,
    staleCause: args.responseBody.staleCause,
    expectedApprovalStatusBefore: args.rowBefore.approvalStatus,
    postRowUpdatedAtBefore: args.rowBefore.postRowUpdatedAt ?? null,
    latestApprovalStatus: nrow.approvalStatus,
    postRowUpdatedAtAfter: nrow.postRowUpdatedAt ?? null,
  };
}
