"use client";

import { useCallback, useEffect, useState } from "react";
import type { ExecutiveKpiOverviewDto } from "@/lib/fulfillment/executive-kpi-forecast-types";

function tierClass(tier: string): string {
  switch (tier) {
    case "critical":
      return "text-red-300";
    case "at_risk":
      return "text-amber-300";
    case "healthy":
      return "text-emerald-300";
    default:
      return "text-slate-300";
  }
}

export function ExecutiveKpiOverviewPanel() {
  const [data, setData] = useState<ExecutiveKpiOverviewDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/admin/executive-agent/kpi/overview?limit=60", {
        credentials: "include",
        cache: "no-store",
      });
      const j = (await r.json().catch(() => ({}))) as ExecutiveKpiOverviewDto & { error?: string };
      if (!r.ok || !j.ok) {
        setError(j.error ?? `KPI overview failed (${r.status})`);
        setData(null);
        return;
      }
      setData(j);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="mt-4 rounded-xl border border-violet-500/25 bg-slate-950/70 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-violet-300/90">
            Executive KPI overview
          </h3>
          <p className="mt-1 text-xs text-slate-500">Advisory metrics — no autonomous corrective actions</p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded border border-slate-600 px-2 py-1 text-[10px] text-slate-300 hover:bg-slate-800"
        >
          Refresh
        </button>
      </div>
      {loading ? <p className="mt-3 text-xs text-slate-500">Loading KPIs…</p> : null}
      {error ? <p className="mt-3 text-xs text-red-300">{error}</p> : null}
      {data ? (
        <div className="mt-3 space-y-3">
          <div className="flex flex-wrap gap-3">
            <div className="rounded-lg border border-slate-700/60 bg-slate-900/50 px-3 py-2">
              <div className="text-[10px] uppercase text-slate-500">Desk health</div>
              <div className={`text-lg font-semibold ${tierClass(data.operationalHealth.tier)}`}>
                {data.operationalHealth.score}/100
              </div>
              <div className="text-[10px] text-slate-500">{data.operationalHealth.tier}</div>
            </div>
            <div className="rounded-lg border border-slate-700/60 bg-slate-900/50 px-3 py-2">
              <div className="text-[10px] uppercase text-slate-500">Velocity</div>
              <div className="text-lg font-semibold text-cyan-200">{data.velocity.velocityScore}</div>
              <div className="text-[10px] text-slate-500">{data.velocity.evidence}</div>
            </div>
            <div className="rounded-lg border border-slate-700/60 bg-slate-900/50 px-3 py-2">
              <div className="text-[10px] uppercase text-slate-500">Active orders</div>
              <div className="text-lg font-semibold text-slate-200">{data.totals.activeOrders}</div>
              <div className="text-[10px] text-slate-500">{data.totals.stalledOrders} stalled</div>
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {data.metrics.map((m) => (
              <div key={m.key} className="rounded border border-slate-800 bg-slate-900/40 px-2 py-1.5">
                <div className="text-[10px] text-slate-500">{m.label}</div>
                <div className="text-sm font-medium text-slate-200">
                  {m.value}
                  {m.unit ? <span className="text-slate-500"> {m.unit}</span> : null}
                </div>
              </div>
            ))}
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-500">Department workload</div>
            <ul className="mt-1 space-y-1">
              {data.departmentWorkload.map((d) => (
                <li key={d.department} className="flex justify-between text-xs text-slate-300">
                  <span>{d.department}</span>
                  <span>
                    load {d.loadIndex} · {d.balanceLabel} · {d.activeOrders} active
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </div>
  );
}
