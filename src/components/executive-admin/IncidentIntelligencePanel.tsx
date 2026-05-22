"use client";

import { useCallback, useEffect, useState } from "react";
import type { ExecutiveCommandIncidentsDto } from "@/lib/executive-agent/executive-command-types";

export function IncidentIntelligencePanel() {
  const [data, setData] = useState<ExecutiveCommandIncidentsDto | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/admin/executive-agent/command/incidents", {
        credentials: "include",
        cache: "no-store",
      });
      const j = (await r.json().catch(() => ({}))) as ExecutiveCommandIncidentsDto;
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

  return (
    <div className="mt-4 rounded-xl border border-orange-500/30 bg-slate-950/70 p-4">
      <h3 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-orange-300/90">
        Incident intelligence
      </h3>
      {loading ? <p className="mt-2 text-xs text-slate-500">Loading…</p> : null}
      {data ? (
        <ul className="mt-3 max-h-36 space-y-1 overflow-y-auto text-xs text-slate-400">
          {data.incidents.length === 0 ? (
            <li>No priority incidents in window.</li>
          ) : (
            data.incidents.map((inc) => (
              <li key={inc.id}>
                <span className="text-orange-200">{inc.severity}</span> — {inc.title}: {inc.summary}
              </li>
            ))
          )}
        </ul>
      ) : !loading ? (
        <p className="mt-2 text-xs text-slate-500">No incident data.</p>
      ) : null}
    </div>
  );
}
