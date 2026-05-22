"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  AgentTaskRouteResult,
  ExecutiveAgentCoordinationOverviewDto,
  ExecutiveDeskAgentId,
} from "@/lib/executive-agent/executive-agent-coordination-types";

type Props = {
  onRouted?: (approvalId?: string) => void;
};

export function AgentRoutingPanel({ onRouted }: Props) {
  const [data, setData] = useState<ExecutiveAgentCoordinationOverviewDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [routingId, setRoutingId] = useState<string | null>(null);
  const [targetAgent, setTargetAgent] = useState<ExecutiveDeskAgentId>("bentley");
  const [rationale, setRationale] = useState("");
  const [lastResult, setLastResult] = useState<AgentTaskRouteResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/admin/executive-agent/agents/overview", {
        credentials: "include",
        cache: "no-store",
      });
      const j = (await r.json().catch(() => ({}))) as ExecutiveAgentCoordinationOverviewDto & {
        error?: string;
      };
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

  async function routeTask(taskId: string) {
    const trimmed = rationale.trim();
    if (!trimmed) {
      setError("Routing rationale is required.");
      return;
    }
    setRoutingId(taskId);
    setError(null);
    setLastResult(null);
    try {
      const r = await fetch("/api/admin/executive-agent/agents/route-task", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId,
          targetAgentId: targetAgent,
          rationale: trimmed,
          humanConfirmed: true,
        }),
      });
      const j = (await r.json().catch(() => ({}))) as AgentTaskRouteResult & {
        error?: string;
        code?: string;
      };
      if (!r.ok || !j.routingId) {
        setError(j.error ?? j.code ?? `Route failed (${r.status})`);
        return;
      }
      setLastResult(j);
      onRouted?.(j.approvalProposal?.approvalId);
      setRationale("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRoutingId(null);
    }
  }

  const routes = data?.routeRecommendations ?? [];

  return (
    <div className="mt-4 rounded-xl border border-sky-500/25 bg-slate-950/70 p-4">
      <h3 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-sky-300/90">
        Agent task routing
      </h3>
      <p className="mt-1 text-xs text-slate-500">Approval-gated routing — no autonomous execution</p>
      {loading ? <p className="mt-2 text-xs text-slate-500">Loading route recommendations…</p> : null}
      {error ? <p className="mt-2 text-xs text-red-300">{error}</p> : null}
      <div className="mt-2 flex flex-wrap gap-2 text-[10px]">
        <select
          value={targetAgent}
          onChange={(e) => setTargetAgent(e.target.value as ExecutiveDeskAgentId)}
          className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-slate-200"
        >
          <option value="bentley">Bentley</option>
          <option value="jarva">Jarva</option>
          <option value="eleanor">Eleanor</option>
          <option value="reality">Reality</option>
        </select>
        <input
          value={rationale}
          onChange={(e) => setRationale(e.target.value)}
          placeholder="Routing rationale"
          className="min-w-[160px] flex-1 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-slate-200"
        />
      </div>
      <ul className="mt-3 max-h-40 space-y-1 overflow-y-auto text-xs text-slate-300">
        {routes.length === 0 && !loading ? (
          <li className="text-slate-500">No route recommendations.</li>
        ) : (
          routes.map((route) => (
            <li key={route.id} className="flex flex-wrap items-center justify-between gap-2 rounded border border-slate-800 px-2 py-1">
              <div>
                <div className="font-medium text-sky-200">{route.taskTitle.slice(0, 48)}</div>
                <div className="text-slate-500">
                  → {route.recommendedAgentId} ({route.confidence})
                </div>
              </div>
              <button
                type="button"
                disabled={routingId === route.taskId}
                onClick={() => void routeTask(route.taskId)}
                className="rounded border border-sky-600/50 px-2 py-1 text-[10px] text-sky-200 hover:bg-sky-950/40 disabled:opacity-50"
              >
                {routingId === route.taskId ? "Routing…" : "Route (approval)"}
              </button>
            </li>
          ))
        )}
      </ul>
      {lastResult ? (
        <p className="mt-2 text-[10px] text-slate-400">
          Routed — {lastResult.message}
          {lastResult.approvalProposal ? ` · approval ${lastResult.approvalProposal.approvalId.slice(0, 8)}…` : ""}
        </p>
      ) : null}
    </div>
  );
}
