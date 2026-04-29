/**
 * Approval-aware scheduled publish worker analytics (operator / Bentley).
 */

export type RevenueOsApprovalWorkerSummary = {
  totalScheduled: number;
  awaitingApproval: number;
  approvedAndEligible: number;
  rejected: number;
  /** From the last worker run the client reported (session), or 0 if unknown. */
  skippedByApproval: number;
  /** Due now (scheduled/retry window) but approval gate blocks the worker. */
  dueNowButBlockedByApproval: number;
  publishingNow: number;
  /** POSTED within the recent window (default 48h). */
  recentlyPublished: number;
  failedOperationally: number;
  retryScheduled: number;
  /** Scheduled/retry posts with persisted `bentley_approval_by_user_id` (governance). */
  scheduledRetryWithApproverUserId?: number;
  /** True if any scheduled/retry row has identity-backed approval metadata. */
  approverIdentitiesPresent?: boolean;
};

export type RevenueOsApprovalWorkerBottleneck =
  | "approval_waiting"
  | "operational_failure"
  | "no_due_posts"
  | "ready_to_run"
  | "mixed";

export type RevenueOsApprovalWorkerInsight = {
  primaryBottleneck: RevenueOsApprovalWorkerBottleneck;
  summaryText: string;
  recommendation: string;
};

export type RevenueOsApprovalWorkerAnalytics = {
  summary: RevenueOsApprovalWorkerSummary;
  insight: RevenueOsApprovalWorkerInsight;
};

/** Subset of `RunDueScheduledPublishesSummary` for client-reported last cron result (no import cycle). */
export type RevenueOsLastWorkerRunSnapshot = {
  skippedAwaitingApproval?: number;
  scanned?: number;
  published?: number;
  retried?: number;
  failed?: number;
  skipped?: number;
};

/** Bundled with GET /api/campaigns/scheduled-queue for UI + Bentley. */
export type ScheduledQueueApprovalWorkerPayload = RevenueOsApprovalWorkerAnalytics & {
  effectiveApprovalRequired: boolean;
  lastWorkerRun?: RevenueOsLastWorkerRunSnapshot | null;
};
