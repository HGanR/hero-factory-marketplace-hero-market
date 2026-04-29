"use client";

import type { PublishApprovalReviewerAnalyticsResult } from "@/lib/revenue-os/publish-approval-reviewer-analytics";

function ageShort(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms)) return "—";
  const h = Math.floor(ms / 3600000);
  if (h < 72) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}

export function PublishApprovalReviewerAnalyticsBlock(props: {
  data: PublishApprovalReviewerAnalyticsResult;
  debug?: boolean;
}) {
  const { data, debug } = props;
  const hasAny =
    data.reviewers.some((r) => r.pendingApprovalCount > 0 || r.overdueApprovalCount > 0) ||
    Object.values(data.byRole).some((b) => b.totalPending > 0);

  return (
    <div
      className="mt-3 rounded-lg border border-slate-800/90 bg-slate-900/50 px-3 py-2 text-[11px] text-slate-300"
      data-bentley-section="publish-approval-reviewer-analytics"
    >
      <div className="font-medium text-slate-200">Reviewer workload</div>
      <div className="mt-1 text-[10px] text-slate-500">
        Pending counts reflect posts each reviewer can act on now (chain step or legacy gate). Sorted by overdue, then
        oldest wait.
      </div>
      {data.reviewers.length > 0 ? (
        <ul className="mt-2 space-y-1">
          {data.reviewers.map((r) => {
            const heavy = r.overdueApprovalCount > 0;
            return (
              <li
                key={r.userId}
                className={`flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[10px] ${
                  heavy ? "text-rose-200/90" : "text-slate-400"
                }`}
              >
                <span className="font-mono text-slate-300">#{r.userId}</span>
                <span className="text-slate-500">{r.reviewerRole}</span>
                <span>
                  p <span className="text-slate-200">{r.pendingApprovalCount}</span>
                </span>
                <span>
                  od <span className={heavy ? "text-rose-200" : "text-slate-200"}>{r.overdueApprovalCount}</span>
                </span>
                <span className="text-slate-500">oldest {ageShort(r.oldestPendingStepAgeMs)}</span>
                {r.recentCompletedCount != null && r.recentCompletedCount > 0 ? (
                  <span className="text-slate-500">done {r.recentCompletedCount}</span>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
      <div className="mt-2 border-t border-slate-800/80 pt-1.5 text-[10px] text-slate-500">
        By role — pending / overdue / avg wait:
        {(["editor", "approver", "owner"] as const).map((k) => {
          const b = data.byRole[k];
          return (
            <span key={k} className="ml-2 inline-block">
              <span className="text-slate-400">{k}</span>: {b.totalPending}/{b.totalOverdue}/{ageShort(b.averagePendingStepAgeMs)}
            </span>
          );
        })}
      </div>
      {!hasAny ? (
        <div className="mt-1 text-[10px] text-slate-500">No pending approvals attributed to reviewers.</div>
      ) : null}
      {debug ? (
        <pre className="mt-2 max-h-48 overflow-auto rounded border border-slate-800 bg-slate-950/80 p-1 text-[9px] text-slate-500">
          {JSON.stringify(data, null, 2)}
        </pre>
      ) : null}
    </div>
  );
}
