/**
 * Aggregate governance-facing approval metrics from workflow rows.
 */

import type { RevenueOsApprovalGovernanceSummary } from "@/lib/revenue-os/publish-approval-governance-types";
import type { RevenueOsPublishWorkflowRow } from "@/lib/revenue-os/publish-workflow-review-types";

export function buildPublishApprovalGovernanceSummary(
  rows: RevenueOsPublishWorkflowRow[],
  approvalModeEffective: boolean
): RevenueOsApprovalGovernanceSummary {
  let pendingCount = 0;
  let approvedCount = 0;
  let rejectedCount = 0;
  let rowsWithDeciderUserId = 0;
  let approvedWithDeciderIdentity = 0;
  let rejectedWithDeciderIdentity = 0;

  for (const r of rows) {
    const s = r.approvalStatus ?? "not_required";
    if (s === "pending_approval") pendingCount += 1;
    else if (s === "approved") approvedCount += 1;
    else if (s === "rejected") rejectedCount += 1;

    const hasUid = r.approvalDecidedByUserId != null;
    if (hasUid) rowsWithDeciderUserId += 1;
    if (hasUid && s === "approved") approvedWithDeciderIdentity += 1;
    if (hasUid && s === "rejected") rejectedWithDeciderIdentity += 1;
  }

  const approverIdentitiesPresent = rowsWithDeciderUserId > 0;

  return {
    approvalModeEffective,
    pendingCount,
    approvedCount,
    rejectedCount,
    approverIdentitiesPresent,
    requiresHumanApproval: approvalModeEffective,
    rowsWithDeciderUserId,
    approvedWithDeciderIdentity,
    rejectedWithDeciderIdentity,
  };
}
