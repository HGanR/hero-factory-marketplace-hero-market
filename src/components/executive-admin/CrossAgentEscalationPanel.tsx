"use client";

import { useCallback, useEffect, useState } from "react";
import type { ExecutiveAgentCoordinationOverviewDto } from "@/lib/executive-agent/executive-agent-coordination-types";

export function CrossAgentEscalationPanel() {
  const [data, setData] = useState<ExecutiveAgentCoordinationOverviewDto | null>(null);
  const [loading, setLoading] = useState(true);
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

  const paths = data?.escalationPaths ?? [];
  const threadLinks = data?.interAgentThreads ?? [];

  return (
    <div className="mt-4 rounded-xl border border-orange-500/25 bg-slate-950/70 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-orange-300/90">
          Cross-agent escalation
        </h3>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded border border-slate-600 px-2 py-1 text-[10px] text-slate-300 hover:bg-slate-800"
        >
          Refresh
        </button>
      </div>
      <p className="mt-1 text-xs text-slate-500">Hierarchy-governed escalation paths — approval required</p>
      {loading ? <p className="mt-2 text-xs text-slate-500">Loading escalation intelligence…</p> : null}
      {error ? <p className="mt-2 text-xs text-red-300">{error}</p> : null}
      {data ? (
        <div className="mt-3 space-y-3">
          <ul className="max-h-32 space-y-1 overflow-y-auto text-xs text-slate-300">
            {paths.length === 0 ? (
              <li className="text-slate-500">No cross-agent escalation paths flagged.</li>
            ) : (
              paths.map((p) => (
                <li key={p.id} className="rounded border border-slate-800 px-2 py-1">
                  <span className="text-orange-200">
                    {p.fromAgentId} → {p.toAgentId}
                  </span>
                  <span className="ml-2 text-slate-500">
                    {p.severity} · {p.trigger}
                  </span>
                </li>
              ))
            )}
          </ul>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-slate-500">Inter-agent threads</p>
            <ul className="mt-1 max-h-24 space-y-1 overflow-y-auto text-[10px] text-slate-400">
              {threadLinks.length === 0 ? (
                <li className="text-slate-500">No active inter-agent thread links.</li>
              ) : (
                threadLinks.slice(0, 8).map((link) => (
                  <li key={link.id}>
                    {link.sourceAgentId} ↔ {link.targetAgentIds.join(", ")} — {link.title.slice(0, 40)}
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      ) : null}
    </div>
  );
}
