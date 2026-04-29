"use client";

import Link from "next/link";
import type { ClientCommandCenterPayload } from "@/lib/revenue-os/client-command-center-data";

export function ClientRequestsPreview({ data }: { data: ClientCommandCenterPayload }) {
  const openLike = data.clientRequests.items.filter((r) => r.status === "open" || r.status === "reviewing");
  return (
    <section className="rounded-xl border border-white/10 bg-slate-900/40 p-4">
      <h2 className="text-sm font-semibold text-cyan-200/90">Requests section</h2>
      {data.clientRequests.backendPending ? (
        <div className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-sm text-amber-100/90">
          Client requests are not enabled yet.
          <div className="mt-1 text-xs text-amber-200/70">
            Next implementation: add a dedicated client request store/API and workflow actions.
          </div>
        </div>
      ) : openLike.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">No open requests.</p>
      ) : (
        <ul className="mt-3 space-y-2 text-sm">
          {openLike.slice(0, 5).map((r) => (
            <li key={r.id} className="rounded border border-white/10 bg-black/20 px-3 py-2">
              {r.title} <span className="text-xs text-slate-500">({r.status})</span>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3 text-xs">
        <Link href={`/ai-revenue-os/clients/${encodeURIComponent(data.clientId)}/inbox`} className="text-cyan-300 hover:underline">
          Review client conversations while requests backend is pending
        </Link>
      </div>
    </section>
  );
}
