/**
 * Bentley: operational publish-workflow review (chat surface).
 */

import { buildPublishApprovalSummary } from "@/lib/revenue-os/build-publish-approval-summary";
import type { RevenueOsPublishWorkflowSummary } from "@/lib/revenue-os/publish-workflow-review-types";

export function isPublishWorkflowReviewIntent(message: string): boolean {
  const t = message.trim().toLowerCase();
  if (/\b(review my posting workflow|posting workflow)\b/.test(t)) return true;
  if (/\bwhat is blocked before publishing\b/.test(t)) return true;
  if (/\bwhat still needs review\b/.test(t)) return true;
  if (/\bshow me what is ready to go out\b/.test(t)) return true;
  if (/\bconfirm my schedule\b/.test(t)) return true;
  if (/\b(ready to go out|queue review|publish queue)\b/.test(t) && /\b(what|show|review)\b/.test(t)) return true;
  return false;
}

export function formatBentleyPublishWorkflowReviewReply(args: {
  summary: RevenueOsPublishWorkflowSummary;
  debug?: boolean;
  /** When the worker approval gate is on (env and/or UI), append a one-line approval snapshot. */
  effectiveApprovalRequired?: boolean;
}): string {
  const { summary, debug, effectiveApprovalRequired } = args;
  const lines: string[] = [];
  lines.push(
    "**Posting workflow review** — operator view of your draft/scheduled queue. I’m **not** confirming schedules or publishing from chat; use **Step 4 → Publish workflow review** to apply changes."
  );

  if (!summary.rows.length) {
    lines.push("No campaign posts loaded yet — create drafts from deployment or open a campaign with posts.");
    return lines.join("\n\n");
  }

  const { counts } = summary;
  lines.push(
    `**Counts:** ${counts.draft} draft · ${counts.scheduled} scheduled/in flight · ${counts.published} published · ${counts.failed} failed.`
  );

  if (summary.readyToConfirm) {
    lines.push("**Status:** no **blocking** conflicts detected in this snapshot — you can confirm schedules from the panel when satisfied.");
  } else {
    lines.push("**Status:** **blocking** issues present — resolve conflicts before treating the queue as clean.");
  }

  if (summary.blockers.length) {
    lines.push("**Blockers / notes:**");
    for (const b of summary.blockers) {
      lines.push(`- ${b}`);
    }
  }

  lines.push("**Next rows (up to 6):**");
  for (const r of summary.rows.slice(0, 6)) {
    const whenRaw = String(r.actualScheduledAt ?? r.suggestedScheduledAt ?? "—");
    const when = whenRaw.length > 44 ? `${whenRaw.slice(0, 44)}…` : whenRaw;
    const role = r.role ? r.role.replace(/_/g, " ") : "role ?";
    const flag = r.hasConflict ? ` ⚠ ${r.conflictSeverity ?? "conflict"}` : "";
    lines.push(
      `- **${r.platform}** · ${role} · ${r.status}${flag}\n  _${when}_ · ${r.bodyPreview.slice(0, 80)}${r.bodyPreview.length > 80 ? "…" : ""}`
    );
  }

  lines.push("Open **Step 4 → Publish workflow review** (`#bentley-publish-workflow-review`).");

  if (effectiveApprovalRequired && summary.rows.length) {
    const a = buildPublishApprovalSummary(summary.rows);
    lines.push(
      `**Approval (timed worker gate on):** pending **${a.pendingApproval}** · approved **${a.approved}** · rejected **${a.rejected}** · worker-eligible **${a.eligibleForWorker}**. Approval is separate from scheduling — use the panel to approve rows.`
    );
  }

  if (debug && summary.sortBasis) {
    lines.push("```json");
    lines.push(JSON.stringify({ sortBasis: summary.sortBasis, rowCount: summary.rows.length }, null, 2));
    lines.push("```");
  }

  return lines.join("\n\n");
}
