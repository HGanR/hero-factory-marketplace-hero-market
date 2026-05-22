"use client";

import { useCallback, useEffect, useState } from "react";
import type { ExecutiveOperatorsRegistryDto } from "@/lib/executive-agent/operator-coordination-service";

export function ExecutiveOperatorPanel() {
  const [data, setData] = useState<ExecutiveOperatorsRegistryDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/admin/executive-agent/operators", {
        credentials: "include",
        cache: "no-store",
      });
      const j = (await r.json().catch(() => ({}))) as ExecutiveOperatorsRegistryDto & { error?: string };
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
    <div className="mt-4 rounded-xl border border-teal-500/25 bg-slate-950/70 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-teal-300/90">
            Operator registry
          </h3>
          <p className="mt-1 text-xs text-slate-500">Governed roles — owner-approved delegation only</p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded border border-slate-600 px-2 py-1 text-[10px] text-slate-300 hover:bg-slate-800"
        >
          Refresh
        </button>
      </div>
      {loading ? <p className="mt-3 text-xs text-slate-500">Loading operators…</p> : null}
      {error ? <p className="mt-3 text-xs text-red-300">{error}</p> : null}
      {data ? (
        <ul className="mt-3 max-h-48 space-y-1.5 overflow-y-auto text-xs text-slate-300">
          {data.operators.map((op) => (
            <li key={op.id} className="rounded border border-slate-800 bg-slate-900/40 px-2 py-1">
              <span className="font-medium text-teal-200">{op.label}</span>
              <span className="ml-2 text-slate-500">
                {op.department ?? "platform"} · tier {op.escalationTier}
                {op.canReceiveDelegation ? " · delegatable" : ""}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
