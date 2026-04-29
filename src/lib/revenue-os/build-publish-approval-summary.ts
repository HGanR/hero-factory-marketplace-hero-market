/**
 * Aggregate approval counts from publish workflow rows.
 */

import {
  userCanActOnApprovalChainStep,
  type CampaignReviewerRole,
} from "@/lib/revenue-os/campaign-reviewer-role";
import type { RevenueOsPublishApprovalStatus, RevenueOsPublishApprovalSummary } from "@/lib/revenue-os/publish-approval-types";
import type { RevenueOsPublishWorkflowRow } from "@/lib/revenue-os/publish-workflow-review-types";
import { parsePublishApprovalFromUtm, rawApprovalStatusKey } from "@/lib/revenue-os/publish-approval-utm";

/** UI + summary: when worker gate is on and no explicit UTM key, treat as pending. */
export function resolveEffectiveApprovalStatus(
  workerRequiresApproval: boolean,
  utm: Record<string, string> | null | undefined
): RevenueOsPublishApprovalStatus {
  if (!rawApprovalStatusKey(utm)) {
    return workerRequiresApproval ? "pending_approval" : "not_required";
  }
  return parsePublishApprovalFromUtm(utm).status;
}

/** Rows that may be included in “approve all ready” (scheduled/retry, non-blocking conflict, not rejected). */
export function isPublishWorkflowBulkApproveSafeRow(r: RevenueOsPublishWorkflowRow): boolean {
  if (r.status !== "scheduled" && r.status !== "retry_scheduled") return false;
  if (r.hasConflict && r.conflictSeverity === "blocking") return false;
  if (r.approvalStatus === "rejected") return false;
  return true;
}

/**
 * Rows eligible for **Approve all** when targeting posts that still need human approval.
 * Excludes approved/rejected/non-schedulable rows; **pending_approval** only (not `not_required`).
 */
export function isRowEligibleForApproveAllPending(r: RevenueOsPublishWorkflowRow): boolean {
  return isPublishWorkflowBulkApproveSafeRow(r) && r.approvalStatus === "pending_approval";
}

/** Preserves input order (workflow list sort is deterministic upstream). */
export function selectRowsForApproveAllPending(
  rows: RevenueOsPublishWorkflowRow[]
): RevenueOsPublishWorkflowRow[] {
  return rows.filter(isRowEligibleForApproveAllPending);
}

/** When the row is gated by a multi-step chain, the viewer must match `currentApprovalRequiredRole`. */
export function rowViewerEligibleForCurrentApprovalChain(
  r: RevenueOsPublishWorkflowRow,
  viewerReviewerRole: CampaignReviewerRole | null | undefined
): boolean {
  const req = r.currentApprovalRequiredRole;
  if (req == null) return true;
  if (!viewerReviewerRole) return false;
  return userCanActOnApprovalChainStep(viewerReviewerRole, req, {});
}

/** Approve-all targets when the viewer may finalize approval; otherwise none (server would 403). */
export function selectApproveAllTargetsForViewer(
  rows: RevenueOsPublishWorkflowRow[],
  mayFinalizePublishApproval: boolean,
  viewerReviewerRole?: CampaignReviewerRole | null
): RevenueOsPublishWorkflowRow[] {
  if (!mayFinalizePublishApproval) return [];
  return selectRowsForApproveAllPending(rows).filter((row) =>
    rowViewerEligibleForCurrentApprovalChain(row, viewerReviewerRole)
  );
}

export function buildPublishApprovalSummary(rows: RevenueOsPublishWorkflowRow[]): RevenueOsPublishApprovalSummary {
  let pendingApproval = 0;
  let approved = 0;
  let rejected = 0;
  let eligibleForWorker = 0;
  let rowsWithDeciderUserId = 0;
  let approvedWithDeciderIdentity = 0;
  let rejectedWithDeciderIdentity = 0;

  for (const r of rows) {
    const s = r.approvalStatus ?? "not_required";
    if (s === "pending_approval") pendingApproval += 1;
    else if (s === "approved") approved += 1;
    else if (s === "rejected") rejected += 1;

    if (r.eligibleForWorker) eligibleForWorker += 1;

    if (r.approvalDecidedByUserId != null) {
      rowsWithDeciderUserId += 1;
      if (s === "approved") approvedWithDeciderIdentity += 1;
      if (s === "rejected") rejectedWithDeciderIdentity += 1;
    }
  }

  return {
    totalRows: rows.length,
    pendingApproval,
    approved,
    rejected,
    eligibleForWorker,
    approverIdentitiesPresent: rowsWithDeciderUserId > 0,
    rowsWithDeciderUserId,
    approvedWithDeciderIdentity,
    rejectedWithDeciderIdentity,
  };
}
