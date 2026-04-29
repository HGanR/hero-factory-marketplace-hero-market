/**
 * Gates for optional automatic variant execution (campaign_posts via sync).
 */

import type { BentleyOptimizationResult } from "@/lib/revenue-os/bentley-optimization";

export type BentleyOptimizationAutoExecuteGateResult = {
  allowed: boolean;
  reasons: string[];
};

export function isBentleyOptimizationAutoExecuteEnvEnabled(): boolean {
  return process.env.BENTLEY_OPTIMIZATION_AUTO_EXECUTE?.trim() === "1";
}

/**
 * Safety: never auto-execute low-confidence diagnoses; never when approval backlog or failures block throughput.
 * Parent must already have at least one `campaign_posts` row (launch materialized).
 */
export function evaluateBentleyOptimizationAutoExecuteGates(args: {
  result: BentleyOptimizationResult;
  /** Parent campaign post rows count — launch completed at least once. */
  parentCampaignPostCount: number;
  postCounts: { failed: number };
  approval: { pendingApprovalCount: number; overdueApprovalCount: number };
}): BentleyOptimizationAutoExecuteGateResult {
  const reasons: string[] = [];
  const { result, parentCampaignPostCount, postCounts, approval } = args;

  if (result.confidence !== "medium" && result.confidence !== "high") {
    reasons.push("confidence_below_medium");
  }
  if (postCounts.failed > 0) {
    reasons.push("parent_has_failed_posts");
  }
  if (approval.pendingApprovalCount > 0) {
    reasons.push("approval_backlog_present");
  }
  if (approval.overdueApprovalCount > 0) {
    reasons.push("approval_overdue_present");
  }
  if (parentCampaignPostCount < 1) {
    reasons.push("parent_launch_not_materialized");
  }

  return { allowed: reasons.length === 0, reasons };
}
