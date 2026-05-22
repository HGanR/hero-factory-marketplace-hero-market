"use client";

import { useCallback, useEffect, useState } from "react";
import type { ExecutiveKpiOverviewDto } from "@/lib/fulfillment/executive-kpi-forecast-types";

export function OperationalHealthPanel() {
  const [data, setData] = useState<ExecutiveKpiOverviewDto | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/admin/executive-agent/kpi/overview?limit=60", {
        credentials: "include",
        cache: "no-store",
      });
      const j = (await r.json().catch(() => ({}))) as ExecutiveKpiOverviewDto;
      if (r.ok && j.ok) setData(j);
      else setData(null);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const health = data?.operationalHealth;

  return (
    <div className="mt-4 rounded-xl border border-emerald-500/20 bg-slate-950/70 p-4">
      <h3 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-300/80">
        Operational health score
      </h3>
      {loading ? <p className="mt-2 text-xs text-slate-500">Scoring desk health…</p> : null}
      {health ? (
        <div className="mt-3">
          <div className="text-2xl font-semibold text-emerald-200">{health.score}/100</div>
          <div className="text-xs capitalize text-slate-400">{health.tier}</div>
          <p className="mt-2 text-xs text-slate-500">{health.evidenceSummary}</p>
          <ul className="mt-3 space-y-1.5">
            {health.factors.map((f) => (
              <li key={f.key} className="flex justify-between gap-2 text-xs">
                <span className="text-slate-400">{f.label}</span>
                <span className={f.impact < 0 ? "text-amber-300" : "text-emerald-300"}>
                  {f.impact > 0 ? "+" : ""}
                  {f.impact}
                </span>
              </li>
            ))}
          </ul>
          {data?.healthByTier ? (
            <div className="mt-3 flex flex-wrap gap-2 text-[10px] text-slate-500">
              {Object.entries(data.healthByTier).map(([tier, n]) => (
                <span key={tier}>
                  {tier}: {n}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      ) : !loading ? (
        <p className="mt-2 text-xs text-slate-500">No health data</p>
      ) : null}
    </div>
  );
}
