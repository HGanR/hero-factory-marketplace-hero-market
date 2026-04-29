/**
 * Multi-user / role-aware publish approval governance (additive; UTM + audit).
 */

export type RevenueOsApprovalActorRole = "owner" | "operator" | "reviewer" | "publisher" | "admin";

/** Normalized decision for governance records (maps from `pending_approval` in storage). */
export type RevenueOsPublishApprovalDecision = "pending" | "approved" | "rejected";

export type RevenueOsPublishApprovalRecord = {
  postId: string;
  decision: RevenueOsPublishApprovalDecision;
  decidedAt?: string;
  decidedByUserId?: number | null;
  decidedByLabel?: string | null;
  actorRole?: RevenueOsApprovalActorRole | null;
  reason?: string | null;
};

export type RevenueOsApprovalGovernanceSummary = {
  approvalModeEffective: boolean;
  pendingCount: number;
  approvedCount: number;
  rejectedCount: number;
  approverIdentitiesPresent: boolean;
  requiresHumanApproval: boolean;
  /** Rows with `bentley_approval_by_user_id` (or legacy strong identity) among scheduled/retry. */
  rowsWithDeciderUserId: number;
  approvedWithDeciderIdentity: number;
  rejectedWithDeciderIdentity: number;
};

export function mapApprovalStatusToDecision(
  status: string | undefined
): RevenueOsPublishApprovalDecision {
  const s = String(status ?? "").toLowerCase();
  if (s === "approved") return "approved";
  if (s === "rejected") return "rejected";
  return "pending";
}
