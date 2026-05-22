"use client";

import { useCallback, useEffect, useState } from "react";
import type { AutomationExecutionResult } from "@/lib/executive-agent/executive-automation-types";

type PendingApproval = {
  id: string;
  proposedAction: string;
  status: string;
  targetType: string | null;
  targetId: string | null;
  createdAt?: string;
};

type Props = {
  onExecuted?: () => void;
};

export function ExecutionApprovalPanel({ onExecuted }: Props) {
  const [pending, setPending] = useState<PendingApproval[]>([]);
  const [loading, setLoading] = useState(true);
  const [executingId, setExecutingId] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<AutomationExecutionResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/admin/executive-agent/approvals?status=pending", {
        credentials: "include",
        cache: "no-store",
      });
      const j = (await r.json().catch(() => ({}))) as { approvals?: PendingApproval[]; error?: string };
      if (!r.ok) {
        setError(j.error ?? `Load failed (${r.status})`);
        setPending([]);
        return;
      }
      setPending(j.approvals ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPending([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function executeApproval(approvalId: string) {
    setExecutingId(approvalId);
    setError(null);
    setLastResult(null);
    try {
      const r = await fetch("/api/admin/executive-agent/automation/execute", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          approvalId,
          approvalSource: "automation_panel",
          humanConfirmed: true,
        }),
      });
      const j = (await r.json().catch(() => ({}))) as AutomationExecutionResult & {
        error?: string;
        code?: string;
      };
      if (!r.ok || !j.executionId) {
        setError(j.error ?? j.code ?? `Execute failed (${r.status})`);
        return;
      }
      setLastResult(j);
      onExecuted?.();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setExecutingId(null);
    }
  }

  return (
    <div className="mt-4 rounded-xl border border-amber-500/30 bg-slate-950/70 p-4">
      <h3 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-300/90">
        Execution approval gate
      </h3>
      <p className="mt-1 text-xs text-slate-500">
        Governed automation execute — policy validation + audit + rollback strategy
      </p>
      {loading ? <p className="mt-2 text-xs text-slate-500">Loading pending approvals…</p> : null}
      {error ? <p className="mt-2 text-xs text-red-300">{error}</p> : null}
      <ul className="mt-3 max-h-48 space-y-2 overflow-y-auto text-xs">
        {pending.length === 0 && !loading ? (
          <li className="text-slate-500">No pending approvals for governed execution.</li>
        ) : (
          pending.map((row) => (
            <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 rounded border border-slate-800 px-2 py-1">
              <div>
                <div className="font-medium text-amber-200">{row.proposedAction}</div>
                <div className="text-slate-500">{row.id.slice(0, 8)}…</div>
              </div>
              <button
                type="button"
                disabled={executingId === row.id}
                onClick={() => void executeApproval(row.id)}
                className="rounded border border-amber-600/50 px-2 py-1 text-[10px] text-amber-200 hover:bg-amber-950/40 disabled:opacity-50"
              >
                {executingId === row.id ? "Executing…" : "Execute (approved)"}
              </button>
            </li>
          ))
        )}
      </ul>
      {lastResult ? (
        <div className="mt-3 rounded border border-slate-800 p-2 text-[10px] text-slate-400">
          <p className="text-emerald-300">
            {lastResult.ok ? "Executed" : "Failed"} — {lastResult.executionPlan.workflowKind}
          </p>
          <p>Policy: {lastResult.policyValidation.allowed ? "passed" : "denied"}</p>
          <p>Rollback: {lastResult.rollbackStrategy.kind}</p>
        </div>
      ) : null}
    </div>
  );
}
