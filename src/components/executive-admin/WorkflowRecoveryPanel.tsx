"use client";

import { useCallback, useEffect, useState } from "react";
import type { ExecutiveWorkflowFabricOverviewDto, WorkflowPauseResumeResult } from "@/lib/executive-agent/executive-workflow-types";

export function WorkflowRecoveryPanel() {
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

  async function resume(workflowId: string) {
    const trimmed = rationale.trim();
    if (!trimmed) {
      setMessage("Rationale required to resume workflow.");
      return;
    }
    setBusyId(workflowId);
    setMessage(null);
    try {
      const r = await fetch("/api/admin/executive-agent/workflows/resume", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workflowId, rationale: trimmed, humanConfirmed: true }),
      });
      const j = (await r.json().catch(() => ({}))) as WorkflowPauseResumeResult & { error?: string };
      if (!r.ok || !j.ok) {
        setMessage(j.error ?? j.message ?? "Resume failed");
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

  const paused = data?.workflows.filter((w) => w.paused) ?? [];
  const recovery = data?.recoveryOptions ?? [];

  return (
    <div className="mt-4 rounded-xl border border-rose-500/25 bg-slate-950/70 p-4">
      <h3 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-rose-300/90">Workflow recovery</h3>
      {loading ? <p className="mt-2 text-xs text-slate-500">Loading…</p> : null}
      <input
        value={rationale}
        onChange={(e) => setRationale(e.target.value)}
        placeholder="Resume rationale"
        className="mt-2 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[10px] text-slate-200"
      />
      <ul className="mt-3 max-h-32 space-y-1 overflow-y-auto text-xs text-slate-300">
        {paused.length === 0 ? (
          <li className="text-slate-500">No paused workflows. {recovery.length} recovery option(s) advisory.</li>
        ) : (
          paused.map((w) => (
            <li key={w.workflowId} className="flex items-center justify-between gap-2 rounded border border-slate-800 px-2 py-1">
              <span>{w.title}</span>
              <button
                type="button"
                disabled={busyId === w.workflowId}
                onClick={() => void resume(w.workflowId)}
                className="rounded border border-rose-600/50 px-2 py-0.5 text-[10px] text-rose-200 disabled:opacity-50"
              >
                Resume
              </button>
            </li>
          ))
        )}
      </ul>
      {message ? <p className="mt-2 text-[10px] text-slate-400">{message}</p> : null}
    </div>
  );
}
