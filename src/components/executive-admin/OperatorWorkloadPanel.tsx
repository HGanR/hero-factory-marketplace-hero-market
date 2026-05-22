"use client";

import { useCallback, useEffect, useState } from "react";
import type { ExecutiveOperatorWorkloadDto } from "@/lib/executive-agent/operator-coordination-service";

export function OperatorWorkloadPanel() {
  const [data, setData] = useState<ExecutiveOperatorWorkloadDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/admin/executive-agent/operators/workload", {
        credentials: "include",
        cache: "no-store",
      });
      const j = (await r.json().catch(() => ({}))) as ExecutiveOperatorWorkloadDto & { error?: string };
      if (!r.ok || !j.ok) {
        setError(j.error ?? `Load failed (${r.status})`);
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
    <div className="mt-4 rounded-xl border border-cyan-500/25 bg-slate-950/70 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-300/90">
          Operator workload
        </h3>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded border border-slate-600 px-2 py-1 text-[10px] text-slate-300 hover:bg-slate-800"
        >
          Refresh
        </button>
      </div>
      {loading ? <p className="mt-3 text-xs text-slate-500">Analyzing workload…</p> : null}
      {error ? <p className="mt-3 text-xs text-red-300">{error}</p> : null}
      {data ? (
        <div className="mt-3 space-y-2 text-xs">
          <ul className="space-y-1">
            {data.workload.slice(0, 8).map((w) => (
              <li key={w.operatorId} className="flex justify-between text-slate-300">
                <span>{w.label}</span>
                <span>
                  load {w.loadIndex} · {w.balanceLabel}
                </span>
              </li>
            ))}
          </ul>
          {data.bottlenecks.length > 0 ? (
            <div className="text-slate-500">
              Bottlenecks: {data.bottlenecks.slice(0, 3).map((b) => b.title).join("; ")}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
