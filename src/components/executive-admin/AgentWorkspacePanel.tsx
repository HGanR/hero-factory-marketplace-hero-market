"use client";

import { useCallback, useEffect, useState } from "react";
import type { ExecutiveAgentWorkspacesDto } from "@/lib/executive-agent/executive-agent-coordination-types";

export function AgentWorkspacePanel() {
  const [data, setData] = useState<ExecutiveAgentWorkspacesDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/admin/executive-agent/agents/workspaces", {
        credentials: "include",
        cache: "no-store",
      });
      const j = (await r.json().catch(() => ({}))) as ExecutiveAgentWorkspacesDto & { error?: string };
      if (!r.ok || !j.ok) {
        setError(j.error ?? `Load failed (${r.status})`);
        setData(null);
        return;
      }
      setData(j);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="mt-4 rounded-xl border border-indigo-500/25 bg-slate-950/70 p-4">
      <h3 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-indigo-300/90">
        Agent workspaces
      </h3>
      <p className="mt-1 text-xs text-slate-500">Persistent workspace state per desk agent</p>
      {loading ? <p className="mt-2 text-xs text-slate-500">Loading workspaces…</p> : null}
      {error ? <p className="mt-2 text-xs text-red-300">{error}</p> : null}
      {data ? (
        <ul className="mt-3 max-h-48 space-y-1.5 overflow-y-auto text-xs text-slate-300">
          {data.workspaces.map((ws) => (
            <li key={ws.agentId} className="rounded border border-slate-800 px-2 py-1">
              <span className="font-medium text-indigo-200">{ws.displayName}</span>
              <span className="ml-2 text-slate-500">
                load {ws.loadIndex} · {ws.activeTasks} tasks · {ws.openThreads} threads · {ws.balanceLabel}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
