"use client";

import { useCallback, useEffect, useState } from "react";
import type { ExecutiveKpiForecastDto } from "@/lib/fulfillment/executive-kpi-forecast-types";

function severityClass(s: string): string {
  switch (s) {
    case "high":
      return "border-red-500/35 text-red-200";
    case "medium":
      return "border-amber-500/35 text-amber-100";
    default:
      return "border-slate-600/40 text-slate-400";
  }
}

export function ForecastRiskPanel() {
  const [data, setData] = useState<ExecutiveKpiForecastDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/admin/executive-agent/kpi/forecast?limit=60", {
        credentials: "include",
        cache: "no-store",
      });
      const j = (await r.json().catch(() => ({}))) as ExecutiveKpiForecastDto & { error?: string };
      if (!r.ok || !j.ok) {
        setError(j.error ?? `Risk forecast failed (${r.status})`);
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
    <div className="mt-4 rounded-xl border border-orange-500/25 bg-slate-950/70 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-orange-300/90">
            Forecast risk alerts
          </h3>
          <p className="mt-1 text-xs text-slate-500">Explainable alerts tied to operational memory</p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded border border-slate-600 px-2 py-1 text-[10px] text-slate-300 hover:bg-slate-800"
        >
          Refresh
        </button>
      </div>
      {loading ? <p className="mt-3 text-xs text-slate-500">Loading alerts…</p> : null}
      {error ? <p className="mt-3 text-xs text-red-300">{error}</p> : null}
      {data ? (
        <ul className="mt-3 max-h-64 space-y-2 overflow-y-auto">
          {data.riskAlerts.length === 0 ? (
            <li className="text-xs text-slate-500">No elevated forecast risks on desk.</li>
          ) : (
            data.riskAlerts.map((a) => (
              <li
                key={a.id}
                className={`rounded border px-2 py-1.5 text-xs ${severityClass(a.severity)}`}
              >
                <div className="font-medium">{a.title}</div>
                <div className="mt-0.5 text-slate-500">{a.rationale}</div>
                <div className="mt-1 flex flex-wrap gap-2 text-[10px] text-slate-500">
                  <span>{a.category}</span>
                  <span>conf {a.confidence}</span>
                  {a.memoryEvidence ? <span>memory</span> : null}
                </div>
              </li>
            ))
          )}
        </ul>
      ) : null}
      {data && data.forecastAwareRecommendations.length > 0 ? (
        <div className="mt-3 border-t border-slate-800 pt-2">
          <div className="text-[10px] uppercase text-slate-500">Forecast-aware recommendations</div>
          <ul className="mt-1 space-y-1 text-xs text-slate-400">
            {data.forecastAwareRecommendations.slice(0, 4).map((r) => (
              <li key={r.id}>{r.title}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
