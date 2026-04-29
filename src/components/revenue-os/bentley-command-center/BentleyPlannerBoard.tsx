"use client";

import type { BentleyPlannerCard, PlannerColumnKey } from "@/lib/revenue-os/social-command-center";

const COL_ORDER: PlannerColumnKey[] = [
  "draft",
  "approval_needed",
  "scheduled",
  "published",
  "failed",
  "retry",
  "suppressed",
  "manual_export",
];

const COL_LABEL: Record<PlannerColumnKey, string> = {
  draft: "Draft",
  approval_needed: "Approval needed",
  scheduled: "Scheduled",
  published: "Published",
  failed: "Failed",
  retry: "Retry",
  suppressed: "Suppressed",
  manual_export: "Manual export",
};

type Props = {
  columns: Record<PlannerColumnKey, BentleyPlannerCard[]>;
  workflowSummaryLine: string;
  cadenceSummaryLine: string | null;
};

export function BentleyPlannerBoard({ columns, workflowSummaryLine, cadenceSummaryLine }: Props) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-white/10 bg-zinc-950/50 p-4 text-sm text-zinc-300">
        <div className="font-medium text-zinc-100">Publishing workflow</div>
        <p className="mt-1 text-zinc-400">{workflowSummaryLine}</p>
        {cadenceSummaryLine ? (
          <p className="mt-2 border-t border-white/5 pt-2 text-zinc-400">
            <span className="text-emerald-400/90">Cadence optimization · </span>
            {cadenceSummaryLine}
          </p>
        ) : null}
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {COL_ORDER.map((key) => (
          <div key={key} className="min-w-[220px] flex-shrink-0">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              {COL_LABEL[key]} ({columns[key]?.length ?? 0})
            </div>
            <div className="space-y-2">
              {(columns[key] ?? []).slice(0, 40).map((c) => (
                <article
                  key={c.queueId}
                  className="rounded-lg border border-white/10 bg-black/40 p-3 text-left text-xs text-zinc-300"
                >
                  <div className="flex flex-wrap items-center gap-1">
                    <span className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] uppercase text-zinc-400">
                      {c.platform}
                    </span>
                    {c.experimentBadge ? (
                      <span className="rounded bg-violet-500/10 px-1.5 py-0.5 text-[10px] text-violet-200">
                        {c.experimentBadge}
                      </span>
                    ) : null}
                    {c.priorityBadge ? (
                      <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] text-amber-100">
                        {c.priorityBadge}
                      </span>
                    ) : null}
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] ${
                        c.connectorReady ? "bg-emerald-500/10 text-emerald-200" : "bg-rose-500/10 text-rose-200"
                      }`}
                    >
                      {c.connectorReady ? "Connector ready" : "Connector check"}
                    </span>
                  </div>
                  <div className="mt-2 line-clamp-2 font-medium text-zinc-100">{c.title}</div>
                  <div className="mt-1 text-[10px] text-zinc-500">{c.workspaceLabel}</div>
                  <p className="mt-2 text-[11px] leading-snug text-zinc-400">{c.publishObjectiveLine}</p>
                  <p className="mt-1 text-[11px] italic text-cyan-200/80">{c.bentleyWhyLine}</p>
                  {c.routingWarning ? (
                    <p className="mt-1 text-[11px] text-amber-200/90">Routing: {c.routingWarning}</p>
                  ) : null}
                  {(c.scheduledFor || c.publishedAt) && (
                    <div className="mt-2 text-[10px] text-zinc-500">
                      {c.scheduledFor ? `Scheduled ${c.scheduledFor.slice(0, 16)}` : `Published ${c.publishedAt?.slice(0, 16)}`}
                    </div>
                  )}
                </article>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
