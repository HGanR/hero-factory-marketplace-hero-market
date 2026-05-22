"use client";

import { useCallback, useEffect, useState } from "react";
import type { ExecutiveKnowledgeOverviewDto } from "@/lib/executive-agent/executive-knowledge-types";

export function StrategicMemoryPanel() {
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

  const mem = data?.strategicMemory;
  const priorities = data?.strategicPriorities;

  return (
    <div className="mt-4 rounded-xl border border-teal-500/25 bg-slate-950/70 p-4">
      <h3 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-teal-300/90">
        Strategic memory
      </h3>
      {loading ? <p className="mt-2 text-xs text-slate-500">Loading…</p> : null}
      {mem ? (
        <div className="mt-3 text-xs text-slate-300">
          <p>Themes: {mem.themes.join(", ") || "—"}</p>
          <p className="mt-1">
            {priorities?.activePriorityCount ?? 0} priority memory item(s) ({priorities?.confidence}{" "}
            confidence)
          </p>
          <ul className="mt-2 max-h-28 space-y-1 overflow-y-auto text-slate-500">
            {mem.longHorizonNotes.slice(0, 5).map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        </div>
      ) : !loading ? (
        <p className="mt-2 text-xs text-slate-500">No strategic memory loaded.</p>
      ) : null}
    </div>
  );
}
