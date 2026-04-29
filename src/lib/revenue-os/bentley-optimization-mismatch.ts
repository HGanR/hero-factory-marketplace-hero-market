/**
 * Operator warnings when optimization state is inconsistent (mirrors launch mismatch pattern).
 */

import type { BentleyOptimizationRunRow } from "@/lib/db/schema";

export type BentleyOptimizationMismatchOpts = {
  /** Latest persisted optimization run for the campaign, if any. */
  latestRun: Pick<BentleyOptimizationRunRow, "childCampaignId" | "resultJson" | "executionMode"> | null;
  /** Whether GET campaign confirms a child row exists when run references one. */
  childCampaignExists?: boolean;
};

export function detectBentleyOptimizationMismatches(opts: BentleyOptimizationMismatchOpts): string[] {
  const issues: string[] = [];
  const run = opts.latestRun;
  if (!run) {
    return issues;
  }

  const childId = run.childCampaignId?.trim();
  const res = run.resultJson as { status?: string } | null;
  if (res?.status === "ready" && run.executionMode !== "recommend_only" && !childId) {
    issues.push("optimization_variant_expected_but_missing");
  }
  if (childId && opts.childCampaignExists === false) {
    issues.push("optimization_child_created_without_lineage");
  }

  const primary = (run.resultJson as { primaryDriver?: string } | null)?.primaryDriver;
  if (primary === "publish_friction") {
    issues.push("optimization_blocked_publish_failure");
  }
  if (res?.status === "insufficient_data") {
    issues.push("optimization_requested_but_no_metrics");
  }

  return [...new Set(issues)];
}
