"use client";

import { useCallback, useEffect, useState } from "react";
import type { AutomationHistoryDto } from "@/lib/executive-agent/executive-automation-types";

export function ExecutiveAutomationPanel() {
  const [history, setHistory] = useState<AutomationHistoryDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/admin/executive-agent/automation/history?limit=20", {
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

  const executions = history?.entries.filter((e) => e.kind === "execution") ?? [];
  const denials = history?.entries.filter((e) => e.kind === "policy_denied") ?? [];

  return (
    <div className="mt-4 rounded-xl border border-emerald-500/30 bg-slate-950/70 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-300/90">
            Executive automation
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            Approval-gated execution — every action requires human confirmation
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded border border-slate-600 px-2 py-1 text-[10px] text-slate-300 hover:bg-slate-800"
        >
          Refresh
        </button>
      </div>
      {loading ? <p className="mt-3 text-xs text-slate-500">Loading automation status…</p> : null}
      {error ? <p className="mt-3 text-xs text-red-300">{error}</p> : null}
      {history ? (
        <div className="mt-3 space-y-1 text-xs text-slate-300">
          <p>
            Recent executions: {executions.length} · Policy denials: {denials.length}
          </p>
          <p className="text-slate-500">
            No autonomous deploy, publish, spend, or governance mutation — department isolation preserved.
          </p>
        </div>
      ) : null}
    </div>
  );
}
