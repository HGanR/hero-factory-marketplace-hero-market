/**
 * Types for the deterministic publish-workflow review list (`buildPublishWorkflowReview`).
 */

import type { RevenueOsContentBatchRole } from "@/lib/revenue-os/content-batch-routing-types";
import type { PublishApprovalChainRequiredRole } from "@/lib/revenue-os/publish-approval-chain";
import type { RevenueOsApprovalActorRole } from "@/lib/revenue-os/publish-approval-governance-types";
import type { RevenueOsPublishApprovalStatus } from "@/lib/revenue-os/publish-approval-types";

/** Debug-only SLA row shape attached in publish workflow review. */
export type PublishApprovalStepSlaDebug = {
  stepStartedAtIso?: string | null;
  logicalAwaitingStepIndex?: number | null;
  overdueAfterMs?: number | null;
  slaReminderSentForLogicalStep?: string | number | null;
  reminderEligible?: boolean;
};

export type RevenueOsPublishWorkflowRowStatus =
  | "draft"
  | "scheduled"
  | "publishing"
  | "published"
  | "retry_scheduled"
  | "failed";

export type RevenueOsPublishWorkflowRow = {
  postId: string;
  platform: string;
  title?: string;
  bodyPreview: string;
  suggestedScheduledAt?: string | null;
  actualScheduledAt?: string | null;
  sequenceDayIndex?: number | null;
  role?: RevenueOsContentBatchRole;
  status: RevenueOsPublishWorkflowRowStatus;
  hasConflict?: boolean;
  conflictSeverity?: "blocking" | "advisory";
  conflictReason?: string;
  approvalStatus?: RevenueOsPublishApprovalStatus;
  approvedAt?: string | null;
  approvalReason?: string | null;
  approvalDecidedAt?: string | null;
  approvalDecidedByLabel?: string | null;
  approvalDecidedByUserId?: number | null;
  approvalActorRole?: RevenueOsApprovalActorRole | null;
  hasApprovalIdentity?: boolean;
  approvalIdentitySessionOnly?: boolean;
  currentApprovalStepIndex?: number | null;
  totalApprovalSteps?: number | null;
  currentApprovalRequiredRole?: PublishApprovalChainRequiredRole | null;
  eligibleForWorker?: boolean;
  postRowUpdatedAt?: string | null;
  approvalStepOverdue?: boolean;
  approvalStepAgeMs?: number | null;
  approvalStepAgeShortLabel?: string | null;
  approvalStepSlaDebug?: PublishApprovalStepSlaDebug | null;
};

export type RevenueOsPublishWorkflowSummary = {
  rows: RevenueOsPublishWorkflowRow[];
  counts: { draft: number; scheduled: number; published: number; failed: number };
  blockers: string[];
  readyToConfirm: boolean;
  sortBasis: string;
};
