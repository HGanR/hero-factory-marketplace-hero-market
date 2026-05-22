"use client";

import { useCallback, useEffect, useState } from "react";
import type { AutomationHistoryDto, AutomationRollbackResult } from "@/lib/executive-agent/executive-automation-types";

type Props = {
  onRolledBack?: () => void;
};

export function RollbackControlPanel({ onRolledBack }: Props) {
  const [history, setHistory] = useState<AutomationHistoryDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [rollingBackId, setRollingBackId] = useState<string | null>(null);
  const [rationale, setRationale] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<AutomationRollbackResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/admin/executive-agent/automation/history?limit=30", {
        credentials: "include",
        cache: "no-store",
      });
      const j = (await r.json().catch(() => ({}))) as AutomationHistoryDto & { error?: string };
      if (!r.ok || !j.ok) {
        setError(j.error ?? `Load failed (${r.status})`);
        setHistory(null);
        return;
      }
      setHistory(j);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setHistory(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const reversibleExecutions =
    history?.entries.filter((e) => e.kind === "execution" && e.ok && e.reversible) ?? [];

  async function rollback(executionAuditId: string) {
    const trimmed = rationale.trim();
    if (!trimmed) {
      setError("Rollback rationale is required.");
      return;
    }
    setRollingBackId(executionAuditId);
    setError(null);
    setLastResult(null);
    try {
      const r = await fetch("/api/admin/executive-agent/automation/rollback", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ executionAuditId, rationale: trimmed }),
      });
      const j = (await r.json().catch(() => ({}))) as AutomationRollbackResult & {
        error?: string;
        code?: string;
      };
      if (!r.ok || !j.rollbackId) {
        setError(j.error ?? j.code ?? `Rollback failed (${r.status})`);
        return;
      }
      setLastResult(j);
      setRationale("");
      setSelectedId(null);
      onRolledBack?.();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRollingBackId(null);
    }
  }

  return (
    <div className="mt-4 rounded-xl border border-violet-500/30 bg-slate-950/70 p-4">
      <h3 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-violet-300/90">
        Rollback control
      </h3>
      <p className="mt-1 text-xs text-slate-500">Reversible executions only — coordination revert or audit reversal</p>
      {loading ? <p className="mt-2 text-xs text-slate-500">Loading reversible executions…</p> : null}
      {error ? <p className="mt-2 text-xs text-red-300">{error}</p> : null}
      <ul className="mt-3 max-h-36 space-y-1 overflow-y-auto text-xs text-slate-300">
        {reversibleExecutions.length === 0 && !loading ? (
          <li className="text-slate-500">No reversible executions in recent history.</li>
        ) : (
          reversibleExecutions.map((row) => (
            <li key={row.id}>
              <button
                type="button"
                onClick={() => setSelectedId(row.id)}
                className={`w-full rounded border px-2 py-1 text-left ${
                  selectedId === row.id ? "border-violet-500/60 bg-violet-950/30" : "border-slate-800"
                }`}
              >
                {row.proposedAction} · {row.id.slice(0, 8)}…
              </button>
            </li>
          ))
        )}
      </ul>
      {selectedId ? (
        <div className="mt-3 space-y-2">
          <textarea
            value={rationale}
            onChange={(e) => setRationale(e.target.value)}
            placeholder="Rollback rationale (required)"
            className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200"
            rows={2}
          />
          <button
            type="button"
            disabled={rollingBackId === selectedId}
            onClick={() => void rollback(selectedId)}
            className="rounded border border-violet-600/50 px-2 py-1 text-[10px] text-violet-200 hover:bg-violet-950/40 disabled:opacity-50"
          >
            {rollingBackId === selectedId ? "Rolling back…" : "Rollback execution"}
          </button>
        </div>
      ) : null}
      {lastResult ? (
        <p className="mt-2 text-[10px] text-slate-400">
          {lastResult.ok ? "Rollback OK" : "Rollback failed"} — {lastResult.message}
          {lastResult.partial ? " (partial)" : ""}
        </p>
      ) : null}
    </div>
  );
}
