"use client";

import { useCallback, useEffect, useState } from "react";
import type { ExecutiveCommandOverviewDto } from "@/lib/executive-agent/executive-command-types";

export function CrisisCoordinationPanel() {
  const [data, setData] = useState<ExecutiveCommandOverviewDto | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/admin/executive-agent/command/overview", {
        credentials: "include",
        cache: "no-store",
      });
      const j = (await r.json().catch(() => ({}))) as ExecutiveCommandOverviewDto;
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

  const crisis = data?.crisisCoordination;

  return (
    <div className="mt-4 rounded-xl border border-rose-500/30 bg-slate-950/70 p-4">
      <h3 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-rose-300/90">
        Crisis coordination
      </h3>
      {loading ? <p className="mt-2 text-xs text-slate-500">Assessing…</p> : null}
      {crisis ? (
        <div className="mt-3 text-xs text-slate-300">
          <p>
            Level: {crisis.crisisLevel} · Departments:{" "}
            {crisis.affectedDepartments.join(", ") || "—"}
          </p>
          <ul className="mt-2 max-h-28 space-y-1 overflow-y-auto text-slate-500">
            {crisis.coordinationSteps.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      ) : !loading ? (
        <p className="mt-2 text-xs text-slate-500">No crisis coordination data.</p>
      ) : null}
    </div>
  );
}
