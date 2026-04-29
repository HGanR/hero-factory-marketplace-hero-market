/**
 * Bentley chat copy for scheduled publish queue (advisory — no worker trigger).
 */

import type { ScheduledQueueApprovalWorkerPayload } from "@/lib/revenue-os/approval-worker-analytics-types";

export function isScheduledPublishQueueIntent(message: string): boolean {
  const t = message.trim().toLowerCase();
  if (
    /\bare my posts scheduled\b/.test(t) ||
    /\bposts scheduled\b/.test(t) ||
    /\bscheduled posts\b/.test(t)
  ) {
    return true;
  }
  if (/\b(did anything fail|any failures|failed posts)\b/.test(t)) return true;
  if (/\bwhat is publishing next\b/.test(t) || /\bwhat'?s publishing next\b/.test(t)) return true;
  if (/\b(did my launch go out|launch go out)\b/.test(t)) return true;
  if (/\bwhat is waiting to post\b/.test(t) || /\bwaiting to post\b/.test(t)) return true;
  return false;
}

export type ScheduledQueueSummaryJson = {
  scheduledCount: number;
  retryScheduledCount: number;
  publishingCount: number;
  failedCount: number;
  postedCount: number;
  nextDue: { postId: string; platform: string; at: string | null } | null;
  recentFailures: { postId: string; platform: string; message: string }[];
  /** Window used for `recentlyPublished` in approval analytics (default 48). */
  recentPublishedWindowHours?: number;
  approvalWorker?: ScheduledQueueApprovalWorkerPayload;
};

export function formatBentleyScheduledQueueReply(q: ScheduledQueueSummaryJson): string {
  const lines: string[] = ["**Scheduled publishing snapshot** (from your campaign posts; I’m not running the worker from chat)."];
  lines.push(
    `• **Scheduled:** ${q.scheduledCount} · **Retry queued:** ${q.retryScheduledCount} · **Publishing:** ${q.publishingCount} · **Failed:** ${q.failedCount} · **Published (total in workspace):** ${q.postedCount}`
  );
  if (q.nextDue) {
    lines.push(
      `• **Next slot:** ${q.nextDue.platform} — ${q.nextDue.at ? new Date(q.nextDue.at).toLocaleString() : "time TBD"}`
    );
  } else {
    lines.push("• **Next slot:** none in the scheduled / retry queue for this workspace.");
  }
  if (q.recentFailures.length) {
    lines.push("• **Recent failures:**");
    q.recentFailures.slice(0, 4).forEach((f) => {
      lines.push(`  – ${f.platform}: ${f.message.slice(0, 120)}${f.message.length > 120 ? "…" : ""}`);
    });
  }
  lines.push(
    "Open **Launch Campaigns** on the dashboard to **Publish now** / **Retry now**, or ensure your host runs `POST /api/internal/scheduled-publish/run` on a cron with `SCHEDULED_PUBLISH_WORKER_SECRET` (or `CRON_SECRET`)."
  );
  let out = lines.join("\n");
  const aw = q.approvalWorker;
  if (aw) {
    const { insight, summary } = aw;
    out += [
      "",
      "**Worker / approval snapshot:**",
      `• ${insight.summaryText}`,
      `• Due now blocked by approval: **${summary.dueNowButBlockedByApproval}** · Eligible: **${summary.approvedAndEligible}** · Failed: **${summary.failedOperationally}**`,
    ].join("\n");
  }
  return out;
}
