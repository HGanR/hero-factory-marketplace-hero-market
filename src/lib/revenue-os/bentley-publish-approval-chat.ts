/**
 * Bentley: publish-approval intents and short intelligence replies (chat surface).
 */

import { buildPublishApprovalSummary } from "@/lib/revenue-os/build-publish-approval-summary";
import type { RevenueOsPublishWorkflowSummary } from "@/lib/revenue-os/publish-workflow-review-types";

/** Session flag mirroring “require approval” in the Publish workflow UI (worker gate alignment). */
export const BENTLEY_UI_REQUIRE_APPROVAL_SESSION_KEY = "bentley_publish_ui_require_approval";

export function isApproveAllFromChatIntent(message: string): boolean {
  const t = message.trim().toLowerCase();
  if (/\bapprove this row only\b/.test(t)) return false;
  if (/\bapprove (all|everything)\b/.test(t)) return true;
  if (/\bapprove all scheduled\b/.test(t)) return true;
  return false;
}

/** Narrow intent: approval status / worker readiness — avoid matching generic industry Q&A. */
export function isPublishApprovalFocusIntent(message: string): boolean {
  const t = message.trim().toLowerCase();
  if (/\bwhat is approved\b/.test(t)) return true;
  if (/\bwhat still needs approval\b/.test(t)) return true;
  if (/\bis anything ready for the worker\b/.test(t)) return true;
  return false;
}

export function formatApproveAllRedirectReply(): string {
  return [
    "**Approve all** is **not executed from chat** — for safety, bulk approval only runs from the dashboard panel.",
    "Open **Step 4 → Publish workflow review** (`#bentley-publish-workflow-review`), review pending rows, then approve there.",
  ].join("\n\n");
}

function isWhoApprovedQuestion(message: string): boolean {
  return /\bwho approved\b/.test(message.trim().toLowerCase());
}

export function formatPublishApprovalIntelligenceReply(args: {
  summary: RevenueOsPublishWorkflowSummary;
  effectiveApprovalRequired: boolean;
  userMessage: string;
  debug?: boolean;
}): string {
  const { summary, effectiveApprovalRequired, userMessage, debug } = args;
  const a = buildPublishApprovalSummary(summary.rows);
  const lines: string[] = [];

  lines.push("**Publish approval — intelligence** — read-only snapshot from your loaded campaign posts. I’m **not** changing approvals from chat.");

  if (!effectiveApprovalRequired) {
    lines.push(
      "**Timed worker approval gate:** off for this reply (env/UI). Counts still reflect stored UTM approval fields when present."
    );
  } else {
    lines.push("**Timed worker approval gate:** on — pending rows are skipped by the worker until approved in the panel.");
  }

  lines.push(
    `pending **${a.pendingApproval}** · approved **${a.approved}** · rejected **${a.rejected}** · worker-eligible rows ${a.eligibleForWorker}.`
  );

  const govParts: string[] = [];
  govParts.push("**Governance:**");
  if (a.approverIdentitiesPresent) {
    govParts.push(
      `persisted approver user id on **${a.rowsWithDeciderUserId ?? 0}** row(s); approved with identity **${a.approvedWithDeciderIdentity ?? 0}**, rejected with identity **${a.rejectedWithDeciderIdentity ?? 0}**.`
    );
  } else {
    govParts.push("no persisted approver user id on rows in this snapshot yet.");
  }
  lines.push(govParts.join(" "));

  if (isWhoApprovedQuestion(userMessage)) {
    const approvedRows = summary.rows.filter((r) => r.approvalStatus === "approved");
    if (!approvedRows.length) {
      lines.push("**Who approved:** no **approved** rows in this snapshot.");
    } else {
      lines.push("**Who approved:**");
      for (const r of approvedRows) {
        const label = r.approvalDecidedByLabel?.trim() || "—";
        const uid = r.approvalDecidedByUserId;
        if (uid != null) {
          lines.push(
            `- **${r.platform}** ${r.postId}: **${label}** (id ${uid}, persisted marketplace user id).`
          );
        } else {
          lines.push(
            `- **${r.platform}** ${r.postId}: **${label}** — **user id not recorded** (label-only / session marker).`
          );
        }
      }
    }
  }

  lines.push("Use **Step 4 → Publish workflow review** to record decisions; chat stays read-only.");

  if (debug && summary.sortBasis) {
    lines.push("```json");
    lines.push(
      JSON.stringify(
        {
          sortBasis: summary.sortBasis,
          rowCount: summary.rows.length,
          approval: a,
        },
        null,
        2
      )
    );
    lines.push("```");
  }

  return lines.join("\n\n");
}
