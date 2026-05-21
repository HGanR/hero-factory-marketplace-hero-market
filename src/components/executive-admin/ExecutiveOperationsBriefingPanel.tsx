"use client";

import { useCallback, useEffect, useState } from "react";
import type { ExecutiveFulfillmentOperationsBriefingDto } from "@/lib/fulfillment/fulfillment-executive-operations-briefing-types";

type Props = {
  onOpenApproval?: (approvalId: string) => void;
};

function shortId(id: string): string {
  return id.length > 10 ? `${id.slice(0, 8)}…` : id;
}

function priorityClass(p: string): string {
  switch (p) {
    case "urgent":
      return "border-red-500/40 bg-red-950/30 text-red-200";
    case "high":
      return "border-amber-500/40 bg-amber-950/30 text-amber-100";
    case "low":
      return "border-slate-600/50 bg-slate-900/40 text-slate-400";
    default:
      return "border-cyan-500/35 bg-cyan-950/30 text-cyan-100";
  }
}

function severityClass(s: string): string {
  switch (s) {
    case "high":
      return "text-red-300";
    case "medium":
      return "text-amber-300";
    default:
      return "text-slate-400";
  }
}

export function ExecutiveOperationsBriefingPanel({ onOpenApproval }: Props) {
  const [briefing, setBriefing] = useState<ExecutiveFulfillmentOperationsBriefingDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/admin/executive-agent/fulfillment-operations/briefing", {
        credentials: "include",
        cache: "no-store",
      });
      const j = (await r.json().catch(() => ({}))) as ExecutiveFulfillmentOperationsBriefingDto & {
        message?: string;
        error?: string;
      };
      if (!r.ok || !j.ok) {
        setError(j.message ?? j.error ?? `Briefing load failed (${r.status})`);
        setBriefing(null);
        return;
      }
      setBriefing(j);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBriefing(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const counts = briefing?.needsMyAttention.counts;

  return (
    <div className="mt-4 rounded-xl border border-[#00e5ff]/25 bg-slate-950/70 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#00e5ff]/80">
            Executive operations briefing
          </h3>
          <p className="mt-0.5 text-[10px] text-slate-500">
            Read-only · WEBSITE + TRUST · recommendations only — no autonomous execution
          </p>
        </div>
        <button
          type="button"
          className="rounded border border-slate-600/60 px-2 py-1 text-[10px] text-slate-300 hover:bg-slate-800/60"
          onClick={() => void load()}
          disabled={loading}
        >
          Refresh
        </button>
      </div>

      {error ? <p className="mt-2 text-xs text-red-300/90">{error}</p> : null}
      {loading ? <p className="mt-2 text-xs text-slate-500">Loading briefing…</p> : null}

      {briefing && !loading ? (
        <div className="mt-3 space-y-4 text-xs text-slate-300">
          <div className="rounded-lg border border-[#00e5ff]/20 bg-[#00e5ff]/5 px-3 py-2">
            <p className="font-medium text-[#00e5ff]/90">{briefing.headline}</p>
            <p className="mt-1 text-slate-400">{briefing.needsMyAttention.summary}</p>
            {counts ? (
              <div className="mt-2 flex flex-wrap gap-2 text-[10px]">
                <span className="rounded border border-slate-700 px-1.5 py-0.5">urgent {counts.urgentActions}</span>
                <span className="rounded border border-slate-700 px-1.5 py-0.5">stalled {counts.stalledOrders}</span>
                <span className="rounded border border-slate-700 px-1.5 py-0.5">owner review {counts.ownerReviewPending}</span>
                <span className="rounded border border-slate-700 px-1.5 py-0.5">client review {counts.clientReviewPending}</span>
                <span className="rounded border border-slate-700 px-1.5 py-0.5">approvals {counts.approvalBacklog}</span>
                <span className="rounded border border-slate-700 px-1.5 py-0.5">cross-dept {counts.crossDepartmentOpportunities}</span>
                <span className="rounded border border-slate-700 px-1.5 py-0.5">risks {counts.riskAlerts}</span>
              </div>
            ) : null}
          </div>

          <section>
            <h4 className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Top 5 urgent actions</h4>
            {briefing.topUrgentActions.length === 0 ? (
              <p className="mt-1 text-slate-500">None flagged urgent.</p>
            ) : (
              <ul className="mt-1 space-y-1">
                {briefing.topUrgentActions.map((a) => (
                  <li key={a.id} className={`rounded border px-2 py-1.5 ${priorityClass(a.priority)}`}>
                    <div className="font-medium">{a.title}</div>
                    <div className="text-[10px] opacity-90">
                      client {shortId(a.clientId)}
                      {a.orderId ? ` · order ${shortId(a.orderId)}` : ""}
                      {a.department ? ` · ${a.department}` : ""}
                    </div>
                    <p className="mt-0.5 text-[10px] opacity-80">{a.rationale}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h4 className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Suggested owner sequence today</h4>
            <ol className="mt-1 list-decimal space-y-1 pl-4 text-[11px] text-slate-400">
              {briefing.suggestedOwnerSequence.map((s) => (
                <li key={s.id}>{s.title}</li>
              ))}
            </ol>
          </section>

          {briefing.approvalBacklog.length > 0 ? (
            <section>
              <h4 className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Approval backlog</h4>
              <ul className="mt-1 space-y-1">
                {briefing.approvalBacklog.slice(0, 8).map((a) => (
                  <li key={a.approvalId} className="flex flex-wrap items-center gap-2 rounded border border-amber-500/30 bg-amber-950/20 px-2 py-1">
                    <span className="text-amber-100">{a.proposedAction}</span>
                    {a.clientId ? <span className="text-slate-500">client {shortId(a.clientId)}</span> : null}
                    <button
                      type="button"
                      className="ml-auto text-[10px] text-[#00e5ff] hover:underline"
                      onClick={() => onOpenApproval?.(a.approvalId)}
                    >
                      Open approval
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {briefing.stalledOrders.length > 0 ? (
            <section>
              <h4 className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Stalled orders</h4>
              <ul className="mt-1 space-y-1 text-[10px] text-orange-200/90">
                {briefing.stalledOrders.slice(0, 6).map((s) => (
                  <li key={s.orderId}>
                    {s.department} · {s.pipelineStage.replace(/_/g, " ")} · {s.daysInStage}d — {s.reason}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {briefing.crossDepartmentOpportunities.length > 0 ? (
            <section>
              <h4 className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Cross-department opportunities</h4>
              <ul className="mt-1 space-y-1">
                {briefing.crossDepartmentOpportunities.slice(0, 5).map((o, i) => (
                  <li key={`${o.clientId}-${i}`} className="rounded border border-violet-500/25 bg-violet-950/20 px-2 py-1">
                    <div className="font-medium text-violet-200">{o.title}</div>
                    <div className="text-[10px] text-slate-500">client {shortId(o.clientId)} · {o.departments.join(" + ")}</div>
                    <p className="text-[10px] text-slate-400">{o.rationale}</p>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {briefing.riskAlerts.length > 0 ? (
            <section>
              <h4 className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Risk alerts</h4>
              <ul className="mt-1 space-y-1">
                {briefing.riskAlerts.slice(0, 6).map((r) => (
                  <li key={r.id} className={`text-[10px] ${severityClass(r.severity)}`}>
                    <span className="font-medium">{r.title}</span> — {r.detail}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <p className="rounded border border-slate-700/50 bg-slate-900/50 px-2 py-1.5 text-[10px] text-slate-500">
            Skipper: {briefing.skipperSummary}
          </p>
        </div>
      ) : null}
    </div>
  );
}
