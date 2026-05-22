"use client";

import { useCallback, useEffect, useState } from "react";
import type { ExecutiveKnowledgeOverviewDto } from "@/lib/executive-agent/executive-knowledge-types";

export function HistoricalContextPanel() {
  const [data, setData] = useState<ExecutiveKnowledgeOverviewDto | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/admin/executive-agent/knowledge/overview", {
        credentials: "include",
        cache: "no-store",
      });
      const j = (await r.json().catch(() => ({}))) as ExecutiveKnowledgeOverviewDto;
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

  const hist = data?.historicalContext;
  const lifecycle = data?.lifecycle;

  return (
    <div className="mt-4 rounded-xl border border-sky-500/25 bg-slate-950/70 p-4">
      <h3 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-sky-300/90">
        Historical context
      </h3>
      {loading ? <p className="mt-2 text-xs text-slate-500">Loading…</p> : null}
      {hist ? (
        <div className="mt-3 text-xs text-slate-300">
          <p className="text-slate-400">{hist.historicalSummary}</p>
          <p className="mt-2">
            {hist.decisionOutcomes.length} decision(s) in ledger ·{" "}
            {lifecycle?.trajectories.filter((t) => t.phase === "at_risk").length ?? 0} at-risk client
            trajectory(ies)
          </p>
          {hist.recentExecutiveActions.length > 0 ? (
            <p className="mt-1 text-slate-500">
              Recent actions: {hist.recentExecutiveActions.slice(0, 4).join(", ")}
            </p>
          ) : null}
        </div>
      ) : !loading ? (
        <p className="mt-2 text-xs text-slate-500">No historical context available.</p>
      ) : null}
    </div>
  );
}
