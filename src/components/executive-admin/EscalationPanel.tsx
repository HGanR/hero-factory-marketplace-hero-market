"use client";

import { useCallback, useEffect, useState } from "react";
import type { ExecutiveOperatorWorkloadDto } from "@/lib/executive-agent/operator-coordination-service";

type Props = {
  onOpenApproval?: (approvalId: string) => void;
};

function severityClass(s: string): string {
  if (s === "high") return "text-red-300 border-red-500/30";
  if (s === "medium") return "text-amber-200 border-amber-500/30";
  return "text-slate-400 border-slate-600/40";
}

export function EscalationPanel({ onOpenApproval }: Props) {
  const [data, setData] = useState<ExecutiveOperatorWorkloadDto | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/admin/executive-agent/operators/workload", {
        credentials: "include",
        cache: "no-store",
      });
      const j = (await r.json().catch(() => ({}))) as ExecutiveOperatorWorkloadDto;
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

  const alerts = data?.escalationAlerts ?? [];

  return (
    <div className="mt-4 rounded-xl border border-rose-500/25 bg-slate-950/70 p-4">
      <h3 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-rose-300/90">
        Escalation intelligence
      </h3>
      <p className="mt-1 text-xs text-slate-500">
        Escalation risks — POST /tasks/[id]/escalate requires owner approval
      </p>
      {loading ? <p className="mt-2 text-xs text-slate-500">Loading…</p> : null}
      <ul className="mt-3 max-h-44 space-y-2 overflow-y-auto">
        {alerts.length === 0 ? (
          <li className="text-xs text-slate-500">No escalation risks elevated.</li>
        ) : (
          alerts.map((a) => (
            <li
              key={a.id}
              className={`rounded border px-2 py-1 text-xs ${severityClass(a.severity)}`}
            >
              <div className="font-medium">{a.title}</div>
              <div className="text-slate-500">{a.rationale}</div>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
