"use client";

import { useCallback, useState } from "react";
import type { ExecutivePlanningGenerateDto } from "@/lib/executive-agent/executive-planning-types";

export function InitiativePlanningPanel() {
  const [planId, setPlanId] = useState("multi_department_ops");
  const [run, setRun] = useState<ExecutivePlanningGenerateDto | null>(null);
  const [loading, setLoading] = useState(false);

  const generate = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/admin/executive-agent/planning/generate", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId, horizonDays: 21 }),
      });
      const j = (await r.json().catch(() => ({}))) as ExecutivePlanningGenerateDto;
      if (r.ok && j.ok) setRun(j);
      else setRun(null);
    } catch {
      setRun(null);
    } finally {
      setLoading(false);
    }
  }, [planId]);

  return (
    <div className="mt-4 rounded-xl border border-rose-500/25 bg-slate-950/70 p-4">
      <h3 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-rose-300/90">
        Initiative planning
      </h3>
      <div className="mt-2 flex flex-wrap gap-2">
        <select
          value={planId}
          onChange={(e) => setPlanId(e.target.value)}
          className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200"
        >
          <option value="multi_department_ops">Multi-department</option>
          <option value="executive_initiative">Executive initiative</option>
          <option value="workload_balance">Workload balance</option>
          <option value="bottleneck_mitigation">Bottleneck mitigation</option>
          <option value="campaign_sequencing">Campaign sequencing</option>
          <option value="governance_scheduling">Governance scheduling</option>
        </select>
        <button
          type="button"
          disabled={loading}
          onClick={() => void generate()}
          className="rounded border border-rose-500/40 px-2 py-1 text-[10px] text-rose-200 hover:bg-rose-950/40 disabled:opacity-50"
        >
          {loading ? "Generating…" : "Generate plan"}
        </button>
      </div>
      {run ? (
        <div className="mt-3 text-xs text-slate-300">
          <p className="text-slate-400">{run.result.skipperSummary}</p>
          <p className="mt-1 text-slate-500">
            Confidence: {run.result.confidence} ({Math.round(run.result.confidenceScore * 100)}%)
          </p>
        </div>
      ) : !loading ? (
        <p className="mt-2 text-xs text-slate-500">Generate governed initiative roadmap.</p>
      ) : null}
    </div>
  );
}
