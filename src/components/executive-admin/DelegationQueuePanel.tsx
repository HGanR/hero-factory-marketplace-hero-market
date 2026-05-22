"use client";

import { useCallback, useEffect, useState } from "react";
import type { ExecutiveOperatorWorkloadDto } from "@/lib/executive-agent/operator-coordination-service";

type Props = {
  onOpenApproval?: (approvalId: string) => void;
};

export function DelegationQueuePanel({ onOpenApproval }: Props) {
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

  const recs = data?.delegationRecommendations ?? [];

  return (
    <div className="mt-4 rounded-xl border border-sky-500/25 bg-slate-950/70 p-4">
      <h3 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-sky-300/90">
        Delegation queue (advisory)
      </h3>
      <p className="mt-1 text-xs text-slate-500">
        Recommendations only — POST /tasks/[id]/delegate queues owner approval
      </p>
      {loading ? <p className="mt-2 text-xs text-slate-500">Loading…</p> : null}
      <ul className="mt-3 max-h-40 space-y-2 overflow-y-auto text-xs text-slate-300">
        {recs.length === 0 ? (
          <li className="text-slate-500">No delegation opportunities flagged.</li>
        ) : (
          recs.map((r) => (
            <li key={r.id} className="rounded border border-slate-800 px-2 py-1">
              <div className="font-medium text-sky-200">{r.title}</div>
              <div className="text-slate-500">{r.rationale}</div>
              {r.taskId ? (
                <div className="mt-1 text-[10px] text-slate-600">task {r.taskId.slice(0, 8)}…</div>
              ) : null}
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
