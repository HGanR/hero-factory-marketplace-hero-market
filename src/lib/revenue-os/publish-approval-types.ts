/**
 * Publish approval gate — additive metadata on campaign_posts.utmParams (bentley_* keys).
 */

export type RevenueOsPublishApprovalStatus = "not_required" | "pending_approval" | "approved" | "rejected";

export type RevenueOsPublishApprovalSummary = {
  totalRows: number;
  pendingApproval: number;
  approved: number;
  rejected: number;
  /** Scheduled/retry rows that can be picked up by the worker under current rules. */
  eligibleForWorker: number;
  /** Rows skipped because approval is required but not granted (worker mode on). */
  skippedAwaitingApproval?: number;
  /** True if any row has persisted decider user id (governance). */
  approverIdentitiesPresent?: boolean;
  /** Scheduled/retry rows with `decidedByUserId` set. */
  rowsWithDeciderUserId?: number;
  approvedWithDeciderIdentity?: number;
  rejectedWithDeciderIdentity?: number;
};
