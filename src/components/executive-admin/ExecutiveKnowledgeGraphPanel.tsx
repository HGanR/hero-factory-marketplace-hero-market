"use client";

import { useCallback, useEffect, useState } from "react";
import type { ExecutiveKnowledgeOverviewDto } from "@/lib/executive-agent/executive-knowledge-types";

export function ExecutiveKnowledgeGraphPanel() {
  const [data, setData] = useState<ExecutiveKnowledgeOverviewDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/admin/executive-agent/knowledge/overview", {
        credentials: "include",
        cache: "no-store",
      });
      const j = (await r.json().catch(() => ({}))) as ExecutiveKnowledgeOverviewDto & { error?: string };
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

  const graph = data?.graph;

  return (
    <div className="mt-4 rounded-xl border border-cyan-500/25 bg-slate-950/70 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-300/90">
            Executive knowledge graph
          </h3>
          <p className="mt-1 text-xs text-slate-500">Long-horizon relationships — read-only</p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded border border-slate-600 px-2 py-1 text-[10px] text-slate-300 hover:bg-slate-800"
        >
          Refresh
        </button>
      </div>
      {loading ? <p className="mt-3 text-xs text-slate-500">Loading graph…</p> : null}
      {error ? <p className="mt-3 text-xs text-red-300">{error}</p> : null}
      {graph ? (
        <div className="mt-3 space-y-1 text-xs text-slate-300">
          <p>
            {graph.nodeCount} nodes · {graph.edgeCount} edges ({graph.confidence} confidence)
          </p>
          <p className="text-slate-500">{data?.skipperSummary}</p>
        </div>
      ) : null}
    </div>
  );
}
