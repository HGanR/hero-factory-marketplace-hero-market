"use client";

import { useCallback, useState } from "react";
import type { ExecutiveSimulationRunDto } from "@/lib/executive-agent/executive-simulation-types";

export function ScenarioComparisonPanel() {
  const [run, setRun] = useState<ExecutiveSimulationRunDto | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/admin/executive-agent/simulation/run", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenarioId: "approval_delay_stress",
          compareToBaseline: true,
        }),
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

  const rows = run?.result.scenarioComparison ?? [];

  return (
    <div className="mt-4 rounded-xl border border-pink-500/25 bg-slate-950/70 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-pink-300/90">
          Scenario comparison
        </h3>
        <button
          type="button"
          disabled={loading}
          onClick={() => void load()}
          className="rounded border border-slate-600 px-2 py-1 text-[10px] text-slate-300 hover:bg-slate-800"
        >
          Compare vs baseline
        </button>
      </div>
      {loading ? <p className="mt-2 text-xs text-slate-500">Comparing…</p> : null}
      {rows.length > 0 ? (
        <table className="mt-3 w-full text-left text-[10px] text-slate-400">
          <thead>
            <tr className="text-slate-500">
              <th className="py-1">Metric</th>
              <th>Baseline</th>
              <th>Scenario</th>
              <th>Δ</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.metric} className="border-t border-slate-800">
                <td className="py-1 text-slate-300">{row.metric}</td>
                <td>{row.baseline}</td>
                <td>{row.scenario}</td>
                <td className={row.better === true ? "text-emerald-400" : row.better === false ? "text-amber-300" : ""}>
                  {row.delta}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : !loading ? (
        <p className="mt-2 text-xs text-slate-500">Run comparison to see baseline vs stress scenario.</p>
      ) : null}
    </div>
  );
}
