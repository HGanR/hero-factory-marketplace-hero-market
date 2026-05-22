"use client";

import { useCallback, useEffect, useState } from "react";
import type { ExecutiveKpiForecastDto } from "@/lib/fulfillment/executive-kpi-forecast-types";

function confidenceBadge(c: string): string {
  if (c === "high") return "bg-red-950/50 text-red-200 border-red-500/30";
  if (c === "medium") return "bg-amber-950/50 text-amber-100 border-amber-500/30";
  return "bg-slate-900/50 text-slate-400 border-slate-600/40";
}

export function FulfillmentForecastPanel() {
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
        setError(j.error ?? `Forecast failed (${r.status})`);
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
    <div className="mt-4 rounded-xl border border-indigo-500/25 bg-slate-950/70 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-indigo-300/90">
            Fulfillment forecast
          </h3>
          <p className="mt-1 text-xs text-slate-500">Confidence-scored projections — forecasting only</p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded border border-slate-600 px-2 py-1 text-[10px] text-slate-300 hover:bg-slate-800"
        >
          Refresh
        </button>
      </div>
      {loading ? <p className="mt-3 text-xs text-slate-500">Loading forecast…</p> : null}
      {error ? <p className="mt-3 text-xs text-red-300">{error}</p> : null}
      {data ? (
        <div className="mt-3 space-y-3 text-xs text-slate-300">
          <p className="text-slate-400">{data.projectedBacklog.evidence}</p>
          <p>
            Projected stalls (7d):{" "}
            <span className="font-medium text-indigo-200">
              {data.projectedBacklog.projectedStallsNext7d}
            </span>{" "}
            <span className={`ml-1 rounded border px-1 py-0.5 text-[9px] ${confidenceBadge(data.projectedBacklog.confidence)}`}>
              {data.projectedBacklog.confidence}
            </span>
          </p>
          {data.fulfillmentDelays.length > 0 ? (
            <div>
              <div className="text-[10px] uppercase text-slate-500">Projected delays</div>
              <ul className="mt-1 max-h-32 space-y-1 overflow-y-auto">
                {data.fulfillmentDelays.slice(0, 6).map((d) => (
                  <li key={d.orderId}>
                    {d.department}: ~{d.projectedDelayDays}d ({d.confidence}) — stall {d.stallLikelihood}%
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {data.revisionRisks.length > 0 ? (
            <div>
              <div className="text-[10px] uppercase text-slate-500">Revision risk</div>
              <ul className="mt-1 space-y-1">
                {data.revisionRisks.slice(0, 4).map((r) => (
                  <li key={r.clientId}>
                    Client {r.clientId.slice(0, 8)}… — {r.revisionBurden} ({r.confidence})
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
