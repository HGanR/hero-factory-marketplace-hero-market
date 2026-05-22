"use client";

import { useCallback, useEffect, useState } from "react";
import type { ExecutiveWorkflowFabricOverviewDto } from "@/lib/executive-agent/executive-workflow-types";

export function WorkflowLifecyclePanel() {
  const [data, setData] = useState<ExecutiveWorkflowFabricOverviewDto | null>(null);
  const [loading, setLoading] = useState(true);

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

  const workflows = data?.workflows ?? [];

  return (
    <div className="mt-4 rounded-xl border border-pink-500/25 bg-slate-950/70 p-4">
      <h3 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-pink-300/90">Workflow lifecycle</h3>
      {loading ? <p className="mt-2 text-xs text-slate-500">Loading…</p> : null}
      <ul className="mt-3 max-h-44 space-y-1 overflow-y-auto text-xs text-slate-300">
        {workflows.length === 0 ? (
          <li className="text-slate-500">No persistent workflows detected.</li>
        ) : (
          workflows.map((w) => (
            <li key={w.workflowId} className="rounded border border-slate-800 px-2 py-1">
              <span className="font-medium text-pink-200">{w.title}</span>
              <span className="ml-2 text-slate-500">
                {w.currentStage}
                {w.paused ? " · paused" : ""}
              </span>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
