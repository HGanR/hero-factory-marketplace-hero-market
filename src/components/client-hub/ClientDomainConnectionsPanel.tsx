"use client";

import type { ClientCommandCenterPayload } from "@/lib/revenue-os/client-command-center-data";

export function ClientDomainConnectionsPanel({ data }: { data: ClientCommandCenterPayload }) {
  const rows = data.domainConnections ?? [];
  if (rows.length === 0) {
    return (
      <section className="rounded-xl border border-white/5 bg-slate-950/40 p-4">
        <h2 className="text-sm font-semibold text-slate-200">Domain connections</h2>
        <p className="mt-1 text-xs text-slate-500">No active domain connection saved for this client’s sites yet.</p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-cyan-500/15 bg-slate-950/50 p-4">
      <h2 className="text-sm font-semibold text-cyan-200/90">Domain connections</h2>
      <p className="mt-1 text-xs text-slate-500">Status from Site Builder → Connect Domain (Vercel / Freename).</p>
      <ul className="mt-3 space-y-3">
        {rows.map((r) => (
          <li
            key={`${r.siteId}-${r.domain}`}
            className="rounded-lg border border-white/5 bg-slate-900/40 px-3 py-2 text-xs text-slate-300"
          >
            <div className="font-medium text-slate-200">{r.domain}</div>
            <div className="mt-1 text-[11px] text-slate-500">
              Site: {r.siteName} · {r.domainType} · {r.provider}
            </div>
            <div className="mt-1 break-all text-[11px] text-slate-400">→ {r.targetUrl}</div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px]">
              <span
                className={
                  r.status === "connected"
                    ? "text-emerald-300/90"
                    : r.status === "failed"
                      ? "text-rose-300/90"
                      : "text-amber-200/80"
                }
              >
                {r.status}
              </span>
              {r.lastCheckedAt ? (
                <span className="text-slate-500">Last checked: {new Date(r.lastCheckedAt).toLocaleString()}</span>
              ) : null}
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <a
                className="rounded border border-slate-600 px-2 py-1 text-[11px] text-cyan-300 hover:border-cyan-500/50"
                href={`/site-builder?siteId=${encodeURIComponent(r.siteId)}`}
                target="_blank"
                rel="noreferrer"
              >
                Open Site Builder
              </a>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
