/**
 * Bentley: approval-aware worker analytics (read-only; no worker trigger / no approve).
 */

import type { ScheduledQueueSummaryJson } from "@/lib/revenue-os/bentley-scheduled-publish-chat";

/** Optional JSON from `POST /api/internal/scheduled-publish/run` body (client stores in session). */
export const BENTLEY_WORKER_LAST_RUN_SESSION_KEY = "bentley_worker_last_run_summary";

export function isApprovalWorkerAnalyticsIntent(message: string): boolean {
  const t = message.trim().toLowerCase();
  if (/\bwhat is waiting on approval\b/.test(t)) return true;
  if (/\bwhat('s| is) ready for the worker\b/.test(t)) return true;
  if (/\bwhat is blocked before publish\b/.test(t)) return true;
  if (/\bis the worker waiting on me\b/.test(t)) return true;
  if (/\bwhat is failing operationally\b/.test(t)) return true;
  if (/\bwhat can publish now\b/.test(t)) return true;
  if (/\bhuman approval\b.*\bbottleneck\b/.test(t)) return true;
  if (/\bapproval.*\boperational\b.*\bfail/.test(t)) return true;
  return false;
}

export function formatBentleyApprovalWorkerAnalyticsReply(args: {
  q: ScheduledQueueSummaryJson;
  debug?: boolean;
}): string {
  const { q, debug } = args;
  const aw = q.approvalWorker;
  if (!aw) {
    return "I couldn’t load approval-aware worker analytics for this workspace. Open **Launch Campaigns** or try again after signing in.";
  }

  const { summary, insight, effectiveApprovalRequired } = aw;
  const lines: string[] = [];
  lines.push("**Scheduled publish worker — approval vs operations** (I’m not running the worker or approving from chat).");
  lines.push(
    effectiveApprovalRequired
      ? "**Approval mode:** on — due posts need explicit approval (or `not_required` in metadata) before the worker claims them."
      : "**Approval mode:** off (legacy) — due scheduled posts can publish without a separate approval step."
  );
  lines.push(`**${insight.summaryText}**`);
  lines.push(`**Primary bottleneck:** \`${insight.primaryBottleneck}\`.`);
  lines.push(`**Recommendation:** ${insight.recommendation}`);
  lines.push("");
  lines.push("**Counts**");
  lines.push(`• Awaiting approval (scheduled / retry queue): **${summary.awaitingApproval}**`);
  lines.push(`• Approved & worker-eligible (connected account, passes gate): **${summary.approvedAndEligible}**`);
  lines.push(`• Due now but blocked by approval: **${summary.dueNowButBlockedByApproval}**`);
  lines.push(`• Rejected (scheduled / retry): **${summary.rejected}**`);
  lines.push(`• Skipped by approval (last run you reported): **${summary.skippedByApproval}**`);
  lines.push(`• Publishing now: **${summary.publishingNow}**`);
  lines.push(`• Failed (operational): **${summary.failedOperationally}**`);
  lines.push(`• Retry scheduled: **${summary.retryScheduled}**`);
  lines.push(`• Recently published (${q.recentPublishedWindowHours ?? 48}h window): **${summary.recentlyPublished}**`);
  if ((summary.scheduledRetryWithApproverUserId ?? 0) > 0 || summary.approverIdentitiesPresent) {
    lines.push(
      `• Scheduled/retry rows with persisted approver user id: **${summary.scheduledRetryWithApproverUserId ?? 0}**`
    );
  }
  lines.push("");
  lines.push("Open **Step 4 → Publish workflow review** (`#bentley-publish-workflow-review`) for approvals, or **Launch Campaigns** for retries.");

  if (debug && aw.lastWorkerRun) {
    lines.push("");
    lines.push("```json");
    lines.push(JSON.stringify({ lastWorkerRun: aw.lastWorkerRun, effectiveApprovalRequired }, null, 2));
    lines.push("```");
  }

  return lines.join("\n");
}
