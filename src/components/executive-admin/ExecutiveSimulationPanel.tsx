"use client";

import { useCallback, useEffect, useState } from "react";
import type { ExecutiveSimulationOverviewDto } from "@/lib/executive-agent/executive-simulation-types";

export function ExecutiveSimulationPanel() {
  const [overview, setOverview] = useState<ExecutiveSimulationOverviewDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/admin/executive-agent/simulation/overview", {
        credentials: "include",
        cache: "no-store",
      });
      const j = (await r.json().catch(() => ({}))) as ExecutiveSimulationOverviewDto & { error?: string };
      if (!r.ok || !j.ok) {
        setError(j.error ?? `Load failed (${r.status})`);
        setOverview(null);
        return;
      }
      setOverview(j);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setOverview(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="mt-4 rounded-xl border border-fuchsia-500/25 bg-slate-950/70 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-fuchsia-300/90">
            Executive simulation
          </h3>
          <p className="mt-1 text-xs text-slate-500">Advisory what-if — no production changes</p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded border border-slate-600 px-2 py-1 text-[10px] text-slate-300 hover:bg-slate-800"
        >
          Refresh
        </button>
      </div>
      {loading ? <p className="mt-3 text-xs text-slate-500">Loading scenarios…</p> : null}
      {error ? <p className="mt-3 text-xs text-red-300">{error}</p> : null}
      {overview ? (
        <div className="mt-3 space-y-2 text-xs text-slate-300">
          <p>
            Baseline: {overview.baselinePreview.activeOrders} active · velocity{" "}
            {overview.baselinePreview.velocityScore} · {overview.baselinePreview.pendingApprovals} pending approvals
          </p>
          <ul className="max-h-36 space-y-1 overflow-y-auto">
            {overview.scenarios.map((s) => (
              <li key={s.id} className="rounded border border-slate-800 px-2 py-1">
                <span className="font-medium text-fuchsia-200">{s.label}</span>
                <span className="ml-2 text-slate-500">{s.description}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
