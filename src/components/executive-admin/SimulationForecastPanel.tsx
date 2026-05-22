"use client";

import { useCallback, useState } from "react";
import type { ExecutiveSimulationRunDto } from "@/lib/executive-agent/executive-simulation-types";

export function SimulationForecastPanel() {
  const [scenarioId, setScenarioId] = useState("baseline");
  const [run, setRun] = useState<ExecutiveSimulationRunDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const execute = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/admin/executive-agent/simulation/run", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenarioId, compareToBaseline: scenarioId !== "baseline" }),
      });
      const j = (await r.json().catch(() => ({}))) as ExecutiveSimulationRunDto & {
        error?: string;
        message?: string;
      };
      if (!r.ok || !j.ok) {
        setError(j.message ?? j.error ?? `Run failed (${r.status})`);
        setRun(null);
        return;
      }
      setRun(j);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setRun(null);
    } finally {
      setLoading(false);
    }
  }, [scenarioId]);

  const res = run?.result;

  return (
    <div className="mt-4 rounded-xl border border-violet-500/30 bg-slate-950/70 p-4">
      <h3 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-violet-300/90">
        Simulation forecast
      </h3>
      <div className="mt-2 flex flex-wrap gap-2">
        <select
          value={scenarioId}
          onChange={(e) => setScenarioId(e.target.value)}
          className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200"
        >
          <option value="baseline">Baseline</option>
          <option value="approval_delay_stress">Approval delay +48h</option>
          <option value="operator_redistribution">Operator redistribution</option>
          <option value="escalation_pressure">Escalation pressure</option>
          <option value="department_rebalance">Department rebalance</option>
          <option value="launch_readiness_watch">Launch readiness watch</option>
          <option value="governance_stagnation_watch">Governance stagnation</option>
        </select>
        <button
          type="button"
          disabled={loading}
          onClick={() => void execute()}
          className="rounded border border-violet-500/40 px-2 py-1 text-[10px] text-violet-200 hover:bg-violet-950/40 disabled:opacity-50"
        >
          {loading ? "Running…" : "Run simulation"}
        </button>
      </div>
      {error ? <p className="mt-2 text-xs text-red-300">{error}</p> : null}
      {res ? (
        <div className="mt-3 space-y-1 text-xs text-slate-300">
          <p className="text-slate-400">{res.skipperSummary}</p>
          <p>
            Timeline: median {res.timeline.medianCompletionDays}d · P90 {res.timeline.p90CompletionDays}d (
            {res.timeline.confidence})
          </p>
          <p>
            Launch P(success): {Math.round(res.campaignLaunchProbability.launchSuccessProbability * 100)}% ·
            Governance stagnation: {Math.round(res.governanceStagnation.stagnationProbability * 100)}%
          </p>
          <p>
            Confidence: {res.confidenceCalibration.overallConfidence} (
            {Math.round(res.confidenceCalibration.overallScore * 100)}%)
          </p>
        </div>
      ) : null}
    </div>
  );
}
