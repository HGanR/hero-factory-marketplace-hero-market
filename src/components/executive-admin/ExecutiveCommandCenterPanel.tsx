"use client";

import { useCallback, useEffect, useState } from "react";
import type { ExecutiveCommandOverviewDto } from "@/lib/executive-agent/executive-command-types";

export function ExecutiveCommandCenterPanel() {
  const [data, setData] = useState<ExecutiveCommandOverviewDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/admin/executive-agent/command/overview", {
        credentials: "include",
        cache: "no-store",
      });
      const j = (await r.json().catch(() => ({}))) as ExecutiveCommandOverviewDto & { error?: string };
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
    <div className="mt-4 rounded-xl border border-red-500/30 bg-slate-950/70 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-red-300/90">
            Executive command center
          </h3>
          <p className="mt-1 text-xs text-slate-500">Live monitoring — no autonomous execution</p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded border border-slate-600 px-2 py-1 text-[10px] text-slate-300 hover:bg-slate-800"
        >
          Refresh
        </button>
      </div>
      {loading ? <p className="mt-3 text-xs text-slate-500">Loading command center…</p> : null}
      {error ? <p className="mt-3 text-xs text-red-300">{error}</p> : null}
      {data ? (
        <div className="mt-3 space-y-1 text-xs text-slate-300">
          <p>
            Crisis: {data.crisisCoordination.crisisLevel} · {data.eventStream.eventCount} events ·{" "}
            {data.alertPrioritization.alertCount} alerts ({data.confidence} confidence)
          </p>
          <p className="text-slate-500">{data.skipperSummary}</p>
        </div>
      ) : null}
    </div>
  );
}
