"use client";

import { useCallback, useEffect, useState } from "react";
import type { ExecutiveKnowledgeOverviewDto } from "@/lib/executive-agent/executive-knowledge-types";

export function OrganizationalIntelligencePanel() {
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

  const patterns = data?.organizationalPatterns;
  const bottlenecks = data?.institutionalBottlenecks;

  return (
    <div className="mt-4 rounded-xl border border-amber-500/25 bg-slate-950/70 p-4">
      <h3 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-300/90">
        Organizational intelligence
      </h3>
      {loading ? <p className="mt-2 text-xs text-slate-500">Loading…</p> : null}
      {patterns ? (
        <div className="mt-3 text-xs text-slate-300">
          <p>{patterns.patterns.length} recurring pattern(s) detected</p>
          <p className="mt-1 text-slate-500">
            Institutional bottlenecks: {bottlenecks?.bottlenecks.length ?? 0} · governance blocks:{" "}
            {bottlenecks?.recurringGovernanceBlocks ?? 0}
          </p>
          <ul className="mt-2 space-y-1 text-slate-500">
            {patterns.institutionalWeaknesses.slice(0, 4).map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      ) : !loading ? (
        <p className="mt-2 text-xs text-slate-500">No organizational patterns yet.</p>
      ) : null}
    </div>
  );
}
