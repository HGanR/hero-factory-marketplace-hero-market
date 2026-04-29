"use client";

import Link from "next/link";
import type { ClientCommandCenterPayload } from "@/lib/revenue-os/client-command-center-data";
import { ClientStatusBadge } from "@/components/client-hub/ClientStatusBadge";

export function ClientPortalStatusPanel({ data }: { data: ClientCommandCenterPayload }) {
  const portalHref = `/ai-revenue-os/clients/${encodeURIComponent(data.clientId)}/portal`;
  const pausedLike = ["paused", "delinquent", "cancelled"].includes(data.serviceStatus.toLowerCase());

  return (
    <section className="rounded-xl border border-white/10 bg-slate-900/40 p-4">
      <h2 className="text-sm font-semibold text-cyan-200/90">Portal section</h2>
      {pausedLike ? (
        <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
          Service is {data.serviceStatus}. Portal may be restricted until service is resumed.
        </div>
      ) : null}
      <div className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
        <div className="rounded-lg border border-white/5 bg-slate-950/40 p-3">
          <p className="text-xs uppercase tracking-wide text-slate-500">Invite status</p>
          <p className="mt-1 text-slate-200">{data.portalSummary.label}</p>
        </div>
        <div className="rounded-lg border border-white/5 bg-slate-950/40 p-3">
          <p className="text-xs uppercase tracking-wide text-slate-500">Active users</p>
          <p className="mt-1 text-slate-200">{data.portalSummary.activeUsers}</p>
        </div>
        <div className="rounded-lg border border-white/5 bg-slate-950/40 p-3">
          <p className="text-xs uppercase tracking-wide text-slate-500">Pending invites</p>
          <p className="mt-1 text-slate-200">{data.portalSummary.pendingInvites}</p>
        </div>
      </div>
      <div className="mt-4 flex items-center gap-2">
        <ClientStatusBadge status={data.serviceStatus} />
        <Link href={portalHref} className="text-xs text-cyan-300 hover:underline">
          Open portal management
        </Link>
      </div>
      <ul className="mt-3 space-y-1 text-xs text-slate-500">
        {data.latestPortalActivity.slice(0, 4).map((a) => (
          <li key={a.id}>
            {new Date(a.createdAt).toLocaleString()} — {a.action}
          </li>
        ))}
      </ul>
    </section>
  );
}
