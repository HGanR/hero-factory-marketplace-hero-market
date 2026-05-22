"use client";

import { useCallback, useEffect, useState } from "react";
import type { ExecutiveCommandOverviewDto } from "@/lib/executive-agent/executive-command-types";

export function GovernanceAlertPanel() {
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

  const anomalies = data?.governanceAnomalies.anomalies ?? [];

  return (
    <div className="mt-4 rounded-xl border border-yellow-500/25 bg-slate-950/70 p-4">
      <h3 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-yellow-300/90">
        Governance alerts
      </h3>
      {loading ? <p className="mt-2 text-xs text-slate-500">Loading…</p> : null}
      {anomalies.length > 0 ? (
        <ul className="mt-3 space-y-1 text-xs text-slate-400">
          {anomalies.map((a) => (
            <li key={a.id}>
              <span className="text-yellow-200">{a.severity}</span> — {a.summary}
            </li>
          ))}
        </ul>
      ) : !loading ? (
        <p className="mt-2 text-xs text-slate-500">No governance anomalies detected.</p>
      ) : null}
    </div>
  );
}
