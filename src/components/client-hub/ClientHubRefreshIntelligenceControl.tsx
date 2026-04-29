"use client";

import { useMemo, useState } from "react";

type Props = {
  clientId: string;
  canManage?: boolean;
};

type RefreshResponse = {
  success: boolean;
  rowsMatched: number;
  rowsChanged: number;
  syncedAt: string;
};

export function ClientHubRefreshIntelligenceControl({ clientId, canManage = true }: Props) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<RefreshResponse | null>(null);

  const syncedAtLabel = useMemo(() => {
    if (!result?.syncedAt) return null;
    const d = new Date(result.syncedAt);
    return Number.isNaN(d.getTime()) ? result.syncedAt : d.toLocaleString();
  }, [result?.syncedAt]);

  if (!canManage) return null;

  return (
    <details className="rounded-lg border border-slate-800/80 bg-slate-950/40 p-3">
      <summary className="cursor-pointer select-none text-xs font-medium text-slate-300">
        Advanced / Admin
      </summary>
      <div className="mt-3 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setErr(null);
              try {
                const r = await fetch(
                  `/api/revenue-os/clients/${encodeURIComponent(clientId)}/refresh-intelligence`,
                  { method: "POST" },
                );
                const j = (await r.json().catch(() => ({}))) as Partial<RefreshResponse> & { error?: string };
                if (!r.ok) {
                  setErr(j.error || "Refresh failed");
                  return;
                }
                setResult({
                  success: true,
                  rowsMatched: Number(j.rowsMatched ?? 0),
                  rowsChanged: Number(j.rowsChanged ?? 0),
                  syncedAt: String(j.syncedAt ?? new Date().toISOString()),
                });
              } catch (e) {
                setErr(e instanceof Error ? e.message : "Refresh failed");
              } finally {
                setBusy(false);
              }
            }}
            className="rounded border border-cyan-500/40 bg-cyan-500/10 px-2 py-1 text-xs text-cyan-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? "Refreshing…" : "Refresh intelligence"}
          </button>
          <span className="text-[11px] text-slate-500">
            Re-sync Site Builder intelligence metrics for this client now.
          </span>
        </div>
        {err ? <p className="text-xs text-rose-300">{err}</p> : null}
        {result ? (
          <p className="text-xs text-slate-300">
            Matched: <span className="text-slate-100">{result.rowsMatched}</span> · Changed:{" "}
            <span className="text-slate-100">{result.rowsChanged}</span> · Synced:{" "}
            <span className="text-slate-100">{syncedAtLabel ?? "—"}</span>
          </p>
        ) : null}
      </div>
    </details>
  );
}
