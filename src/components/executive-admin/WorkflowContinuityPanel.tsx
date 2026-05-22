"use client";

import { useCallback, useEffect, useState } from "react";
import type { ExecutiveWorkflowFabricOverviewDto, WorkflowPauseResumeResult } from "@/lib/executive-agent/executive-workflow-types";

export function WorkflowContinuityPanel() {
  const [data, setData] = useState<ExecutiveWorkflowFabricOverviewDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rationale, setRationale] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/admin/executive-agent/workflows/overview", { credentials: "include", cache: "no-store" });
      const j = (await r.json().catch(() => ({}))) as ExecutiveWorkflowFabricOverviewDto;
      if (r.ok && j.ok) setData(j);
      else setData(null);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function pause(workflowId: string) {
    const trimmed = rationale.trim();
    if (!trimmed) {
      setMessage("Rationale required to pause workflow.");
      return;
    }
    setBusyId(workflowId);
    setMessage(null);
    try {
      const r = await fetch("/api/admin/executive-agent/workflows/pause", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workflowId, rationale: trimmed, humanConfirmed: true }),
      });
      const j = (await r.json().catch(() => ({}))) as WorkflowPauseResumeResult & { error?: string };
      if (!r.ok || !j.ok) {
        setMessage(j.error ?? j.message ?? "Pause failed");
        return;
      }
      setMessage(j.message);
      setRationale("");
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  }

  const signals = data?.continuitySignals ?? [];
  const atRisk = signals.filter((s) => s.risk === "degraded" || s.risk === "broken");

  return (
    <div className="mt-4 rounded-xl border border-teal-500/25 bg-slate-950/70 p-4">
      <h3 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-teal-300/90">Workflow continuity</h3>
      {loading ? <p className="mt-2 text-xs text-slate-500">Loading…</p> : null}
      <input
        value={rationale}
        onChange={(e) => setRationale(e.target.value)}
        placeholder="Pause rationale (humanConfirmed)"
        className="mt-2 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[10px] text-slate-200"
      />
      <ul className="mt-3 max-h-36 space-y-1 overflow-y-auto text-xs text-slate-300">
        {atRisk.length === 0 ? (
          <li className="text-slate-500">Continuity stable across monitored workflows.</li>
        ) : (
          atRisk.map((s) => {
            const wf = data?.workflows.find((w) => w.workflowId === s.workflowId);
            return (
              <li key={s.workflowId} className="flex items-center justify-between gap-2 rounded border border-slate-800 px-2 py-1">
                <span>
                  {s.risk} · score {s.continuityScore}
                  {wf && !wf.paused ? "" : " · paused"}
                </span>
                {wf && !wf.paused ? (
                  <button
                    type="button"
                    disabled={busyId === s.workflowId}
                    onClick={() => void pause(s.workflowId)}
                    className="rounded border border-teal-600/50 px-2 py-0.5 text-[10px] text-teal-200 disabled:opacity-50"
                  >
                    Pause
                  </button>
                ) : null}
              </li>
            );
          })
        )}
      </ul>
      {message ? <p className="mt-2 text-[10px] text-slate-400">{message}</p> : null}
    </div>
  );
}
