"use client";

import Link from "next/link";
import type { ClientCommandCenterPayload } from "@/lib/revenue-os/client-command-center-data";

export function ClientCrmAnalyticsPanel({ data }: { data: ClientCommandCenterPayload }) {
  const inboxHref = `/ai-revenue-os/clients/${encodeURIComponent(data.clientId)}/inbox`;
  const analyticsHref = `/ai-revenue-os/clients/${encodeURIComponent(data.clientId)}/analytics`;
  return (
    <section className="rounded-xl border border-white/10 bg-slate-900/40 p-4">
      <h2 className="text-sm font-semibold text-cyan-200/90">CRM / Analytics section</h2>
      <div className="mt-4 grid gap-3 text-sm sm:grid-cols-3 lg:grid-cols-5">
        <Card label="Leads" value={data.metrics.leadsCaptured} />
        <Card label="Conversations" value={data.metrics.conversations} />
        <Card label="Bookings" value={data.metrics.bookings} />
        <Card label="Widget messages" value={data.metrics.widgetMessages} />
        <Card label="Last activity" value={data.lastActivityAt ? new Date(data.lastActivityAt).toLocaleDateString() : "—"} />
      </div>
      <div className="mt-4 flex gap-3 text-xs">
        <Link href={inboxHref} className="text-cyan-300 hover:underline">Open inbox</Link>
        <Link href={analyticsHref} className="text-cyan-300 hover:underline">Open analytics</Link>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div>
          <h3 className="text-xs uppercase tracking-wide text-slate-500">Latest conversations</h3>
          <ul className="mt-2 space-y-1 text-xs text-slate-300">
            {data.latestConversations.slice(0, 4).map((c) => (
              <li key={c.id} className="rounded border border-white/5 bg-black/20 px-2 py-1">
                {(c.subject || c.lastMessagePreview || "(no subject)").slice(0, 80)}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="text-xs uppercase tracking-wide text-slate-500">Latest contacts</h3>
          <ul className="mt-2 space-y-1 text-xs text-slate-300">
            {data.latestContacts.slice(0, 4).map((c) => (
              <li key={c.id} className="rounded border border-white/5 bg-black/20 px-2 py-1">
                {c.name || c.email || "Unnamed"} {c.company ? `· ${c.company}` : ""}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function Card({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-white/5 bg-slate-950/40 p-3">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-slate-200">{value}</p>
    </div>
  );
}
