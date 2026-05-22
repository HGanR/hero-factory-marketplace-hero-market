"use client";

import { useCallback, useState } from "react";
import type { ExecutiveSimulationRunDto } from "@/lib/executive-agent/executive-simulation-types";

export function BottleneckCascadePanel() {
  const [run, setRun] = useState<ExecutiveSimulationRunDto | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/admin/executive-agent/simulation/run", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenarioId: "baseline" }),
      });
      const j = (await r.json().catch(() => ({}))) as ExecutiveSimulationRunDto;
      if (r.ok && j.ok) setRun(j);
      else setRun(null);
    } catch {
      setRun(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const cascade = run?.result.bottleneckCascade;

  return (
    <div className="mt-4 rounded-xl border border-orange-500/25 bg-slate-950/70 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-orange-300/90">
          Bottleneck cascade
        </h3>
        <button
          type="button"
          disabled={loading}
          onClick={() => void load()}
          className="rounded border border-slate-600 px-2 py-1 text-[10px] text-slate-300 hover:bg-slate-800"
        >
          Simulate
        </button>
      </div>
      {loading ? <p className="mt-2 text-xs text-slate-500">Simulating cascade…</p> : null}
      {cascade ? (
        <div className="mt-3 text-xs text-slate-300">
          <p>
            Initial bottlenecks: {cascade.initialBottlenecks} · projected depth:{" "}
            {cascade.projectedCascadeDepth}
          </p>
          <p>Revision cascade risk: {Math.round(cascade.revisionCascadeRisk * 100)}%</p>
          <p className="mt-1 text-slate-500">
            Departments: {cascade.affectedDepartments.join(", ") || "—"} ({cascade.confidence} confidence)
          </p>
        </div>
      ) : !loading ? (
        <p className="mt-2 text-xs text-slate-500">Run simulation to model cascade risk.</p>
      ) : null}
    </div>
  );
}
