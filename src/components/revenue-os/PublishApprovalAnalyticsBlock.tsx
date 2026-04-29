"use client";

import type {
  PublishApprovalAnalyticsSummary,
  PublishApprovalStalledPostRow,
} from "@/lib/revenue-os/publish-approval-analytics";
import {
  formatAveragePendingAgeShort,
  formatOldestPendingAgeShort,
  formatRoleBreakdownCompact,
  formatStepBreakdownCompact,
} from "@/lib/revenue-os/publish-approval-analytics-ui";

export function PublishApprovalAnalyticsBlock(props: {
  summary: PublishApprovalAnalyticsSummary;
  stalledPosts: PublishApprovalStalledPostRow[];
  debug?: boolean;
}) {
  const { summary, stalledPosts, debug } = props;
  const hasSignal =
    summary.pendingApprovalCount > 0 ||
    summary.overdueApprovalCount > 0 ||
    stalledPosts.some((p) => p.approvalStepOverdue);

  return (
    <div
      className="mt-3 rounded-lg border border-slate-800/90 bg-slate-900/50 px-3 py-2 text-[11px] text-slate-300"
      data-bentley-section="publish-approval-analytics"
    >
      <div className="font-medium text-slate-200">Approval analytics</div>
      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
        <span>
          Pending: <span className="text-slate-100">{summary.pendingApprovalCount}</span>
        </span>
        <span>
          Overdue:{" "}
          <span className={summary.overdueApprovalCount > 0 ? "text-rose-200/95" : "text-slate-100"}>
            {summary.overdueApprovalCount}
          </span>
        </span>
        <span>
          Oldest wait: <span className="text-slate-100">{formatOldestPendingAgeShort(summary)}</span>
        </span>
        <span>
          Avg wait: <span className="text-slate-100">{formatAveragePendingAgeShort(summary)}</span>
        </span>
      </div>
      <div className="mt-1 text-[10px] text-slate-500">
        By role: <span className="text-slate-400">{formatRoleBreakdownCompact(summary.byRole)}</span>
      </div>
      <div className="text-[10px] text-slate-500">
        By step: <span className="text-slate-400">{formatStepBreakdownCompact(summary.byStepIndex)}</span>
      </div>
      {stalledPosts.length > 0 ? (
        <div className="mt-2 border-t border-slate-800/80 pt-1.5">
          <div className="text-[10px] font-medium uppercase tracking-wide text-slate-500">Most stalled</div>
          <ul className="mt-1 space-y-0.5">
            {stalledPosts.slice(0, 8).map((p) => (
              <li key={p.postId} className="flex flex-wrap items-baseline gap-x-2 text-[10px] text-slate-400">
                <code className="text-slate-300">{p.postId.slice(0, 8)}…</code>
                {p.totalApprovalSteps != null ? (
                  <span>
                    step {p.currentApprovalStepIndex + 1}/{p.totalApprovalSteps}
                  </span>
                ) : (
                  <span>step —</span>
                )}
                {p.currentApprovalRequiredRole ? <span>{p.currentApprovalRequiredRole}</span> : null}
                <span className={p.approvalStepOverdue ? "text-rose-200/90" : ""}>
                  {p.approvalStepAgeShortLabel ?? "—"}
                  {p.approvalStepOverdue ? " · overdue" : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : hasSignal ? null : (
        <div className="mt-1 text-[10px] text-slate-500">No pending approvals in this campaign.</div>
      )}
      {debug ? (
        <pre className="mt-2 max-h-40 overflow-auto rounded border border-slate-800 bg-slate-950/80 p-1 text-[9px] text-slate-500">
          {JSON.stringify({ summary, stalledPosts }, null, 2)}
        </pre>
      ) : null}
    </div>
  );
}
