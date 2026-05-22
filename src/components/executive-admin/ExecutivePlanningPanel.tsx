"use client";

import { useCallback, useEffect, useState } from "react";
import type { ExecutivePlanningOverviewDto } from "@/lib/executive-agent/executive-planning-types";

export function ExecutivePlanningPanel() {
  const [overview, setOverview] = useState<ExecutivePlanningOverviewDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/admin/executive-agent/planning/overview", {
        credentials: "include",
        cache: "no-store",
      });
      const j = (await r.json().catch(() => ({}))) as ExecutivePlanningOverviewDto & { error?: string };
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
    <div className="mt-4 rounded-xl border border-indigo-500/30 bg-slate-950/70 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-indigo-300/90">
            Executive planning
          </h3>
          <p className="mt-1 text-xs text-slate-500">Advisory plans only — no autonomous execution</p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded border border-slate-600 px-2 py-1 text-[10px] text-slate-300 hover:bg-slate-800"
        >
          Refresh
        </button>
      </div>
      {loading ? <p className="mt-3 text-xs text-slate-500">Loading plans…</p> : null}
      {error ? <p className="mt-3 text-xs text-red-300">{error}</p> : null}
      {overview ? (
        <div className="mt-3 space-y-1 text-xs text-slate-300">
          <p>
            Desk: {overview.deskPreview.activeOrders} active · {overview.deskPreview.stalledOrders}{" "}
            stalled · {overview.deskPreview.openTasks} open tasks
          </p>
          <ul className="max-h-32 space-y-1 overflow-y-auto text-slate-500">
            {overview.plans.map((p) => (
              <li key={p.id}>
                <span className="text-indigo-200">{p.label}</span> — {p.description}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
