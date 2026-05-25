/**
 * Detect inconsistencies between Bentley workflow artifacts and launch execution expectations.
 */

import type { BentleyWorkflowState } from "@/lib/revenue-os/bentley-workflow";
import { getFirstIncompleteWorkflowPhase } from "@/lib/revenue-os/bentley-workflow";
import { coerceTrimmedString } from "@/lib/revenue-os/bentley-string-coerce";

export function detectBentleyLaunchMismatches(
  wf: BentleyWorkflowState,
  opts?: { campaignPostCount?: number }
): string[] {
  const issues: string[] = [];
  const cid = coerceTrimmedString(wf.artifacts.bentleyDbCampaignId);
  const synced = coerceTrimmedString(wf.artifacts.bentleyLaunchSyncedAt);
  const next = getFirstIncompleteWorkflowPhase(wf);
  const postCount = opts?.campaignPostCount;

  if (cid && typeof postCount === "number" && postCount === 0) {
    issues.push("workflow_has_db_campaign_but_no_posts");
  }

  if (cid && !synced) {
    issues.push("workflow_has_db_campaign_but_no_launch_sync_timestamp");
  }
  if (synced && next === "launch_ready") {
    issues.push("launch_sync_recorded_but_launch_ready_still_incomplete");
  }
  if (!cid && synced) {
    issues.push("launch_sync_without_db_campaign_id");
  }

  const err = coerceTrimmedString(wf.lastError);
  if (
    err &&
    (err.includes("Launch sync returned no campaign posts") ||
      err.includes("cannot complete launch_ready"))
  ) {
    issues.push("launch_finalize_blocked_empty_post_ids");
  }

  return [...new Set(issues)];
}
