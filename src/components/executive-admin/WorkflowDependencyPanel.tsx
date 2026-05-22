"use client";

import { useCallback, useEffect, useState } from "react";
import type { ExecutiveWorkflowFabricOverviewDto } from "@/lib/executive-agent/executive-workflow-types";

export function WorkflowDependencyPanel() {
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

  const graphs = data?.dependencyGraphs ?? [];
  const links = data?.crossDepartmentLinks ?? [];

  return (
    <div className="mt-4 rounded-xl border border-violet-500/25 bg-slate-950/70 p-4">
      <h3 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-violet-300/90">Workflow dependencies</h3>
      {loading ? <p className="mt-2 text-xs text-slate-500">Loading…</p> : null}
      <ul className="mt-3 max-h-36 space-y-1 overflow-y-auto text-[10px] text-slate-400">
        {graphs.length === 0 ? (
          <li className="text-slate-500">No dependency graphs.</li>
        ) : (
          graphs.slice(0, 8).map((g) => (
            <li key={g.workflowId}>
              {g.workflowId.slice(0, 24)}… — {g.nodes.length} nodes
              {g.hasCycle ? " · cycle" : ""}
              {g.blockedNodeIds.length ? ` · ${g.blockedNodeIds.length} blocked` : ""}
            </li>
          ))
        )}
      </ul>
      <p className="mt-2 text-[10px] uppercase tracking-wider text-slate-500">Cross-department chains: {links.length}</p>
    </div>
  );
}
