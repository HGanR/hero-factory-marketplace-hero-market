"use client";

import { useCallback, useEffect, useState } from "react";
import type { AutomationHistoryDto } from "@/lib/executive-agent/executive-automation-types";

export function AutomationHistoryPanel() {
  const [data, setData] = useState<AutomationHistoryDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/admin/executive-agent/automation/history?limit=50", {
        credentials: "include",
        cache: "no-store",
      });
      const j = (await r.json().catch(() => ({}))) as AutomationHistoryDto & { error?: string };
      if (!r.ok || !j.ok) {
        setError(j.error ?? `Load failed (${r.status})`);
        setData(null);
        return;
      }
      setData(j);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="mt-4 rounded-xl border border-slate-600/40 bg-slate-950/70 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-300/90">
          Automation history
        </h3>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded border border-slate-600 px-2 py-1 text-[10px] text-slate-300 hover:bg-slate-800"
        >
          Refresh
        </button>
      </div>
      {loading ? <p className="mt-3 text-xs text-slate-500">Loading audit history…</p> : null}
      {error ? <p className="mt-3 text-xs text-red-300">{error}</p> : null}
      {data ? (
        <ul className="mt-3 max-h-52 space-y-1 overflow-y-auto text-[10px] text-slate-400">
          {data.entries.length === 0 ? (
            <li className="text-slate-500">No automation audit entries yet.</li>
          ) : (
            data.entries.map((e) => (
              <li key={e.id} className="rounded border border-slate-800 px-2 py-1">
                <span className={e.ok ? "text-emerald-400" : "text-red-400"}>{e.kind}</span>
                {" · "}
                {e.proposedAction ?? "—"}
                {" · "}
                {e.approvalSource ?? "—"}
                {" · "}
                {new Date(e.createdAt).toLocaleString()}
                {e.reversible ? " · reversible" : ""}
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
