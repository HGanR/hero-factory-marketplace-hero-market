"use client";

import { useCallback, useState } from "react";
import type { ExecutivePlanningGenerateDto } from "@/lib/executive-agent/executive-planning-types";

export function RecoveryPlanningPanel() {
  const [run, setRun] = useState<ExecutivePlanningGenerateDto | null>(null);
  const [loading, setLoading] = useState(false);

  const generate = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/admin/executive-agent/planning/generate", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: "operational_recovery", horizonDays: 14 }),
      });
      const j = (await r.json().catch(() => ({}))) as ExecutivePlanningGenerateDto;
      if (r.ok && j.ok) setRun(j);
      else setRun(null);
    } catch {
      setRun(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const plan = run?.result.operationalRecovery;

  return (
    <div className="mt-4 rounded-xl border border-emerald-500/25 bg-slate-950/70 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-300/90">
          Recovery planning
        </h3>
        <button
          type="button"
          disabled={loading}
          onClick={() => void generate()}
          className="rounded border border-slate-600 px-2 py-1 text-[10px] text-slate-300 hover:bg-slate-800 disabled:opacity-50"
        >
          Generate
        </button>
      </div>
      {loading ? <p className="mt-2 text-xs text-slate-500">Generating…</p> : null}
      {plan ? (
        <div className="mt-3 text-xs text-slate-300">
          <p className="text-slate-400">{plan.summary}</p>
          <ol className="mt-2 max-h-36 list-decimal space-y-1 overflow-y-auto pl-4 text-slate-500">
            {plan.steps.map((s) => (
              <li key={s.order}>{s.action}</li>
            ))}
          </ol>
        </div>
      ) : !loading ? (
        <p className="mt-2 text-xs text-slate-500">Generate a recovery plan for stalled desk items.</p>
      ) : null}
    </div>
  );
}
