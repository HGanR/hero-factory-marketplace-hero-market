/**
 * Shared planner column mapping for distribution queue + routing (command center + explainability).
 */

import type { ConnectorRoutingStatus } from "@/lib/revenue-os/distribution-routing";
import type { DistributionQueueRow } from "@/lib/revenue-os/distribution-queue-actions";

export type PlannerColumnKey =
  | "draft"
  | "approval_needed"
  | "scheduled"
  | "published"
  | "failed"
  | "retry"
  | "suppressed"
  | "manual_export";

/** Maps queue + routing to planner column — exported for tests and explainability. */
export function plannerColumnKeyForItem(input: {
  queue: DistributionQueueRow;
  worstRouting: ConnectorRoutingStatus | null;
}): PlannerColumnKey {
  const q = input.queue;
  if (q.queueStatus === "archived") return "draft";
  if (q.suppressionReason?.trim()) return "suppressed";
  if (input.worstRouting === "requires_manual_export") return "manual_export";
  if (q.queueStatus === "published") return "published";
  if (q.queueStatus === "failed") {
    return (q.publishAttemptCount ?? 0) > 1 ? "retry" : "failed";
  }
  if (q.queueStatus === "scheduled" || q.queueStatus === "approved") return "scheduled";
  if (q.queueStatus === "draft" && q.approvalStatus === "pending") return "approval_needed";
  if (q.queueStatus === "draft") return "draft";
  return "scheduled";
}
