"use client";

import React, { useState } from "react";

export type CalendarLinkSummaryUi = {
  provider: string;
  syncMode: string;
  externalEventUrl: string | null;
  lastSyncedAt: string | null;
};

export function BroadcastCalendarLinkCard({
  broadcastEventId,
  hostWalletAddress,
  link,
  onChanged,
}: {
  broadcastEventId: number;
  hostWalletAddress: string;
  link: CalendarLinkSummaryUi | null;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function post(url: string, body: Record<string, unknown>) {
    setBusy(true);
    setMsg(null);
    const res = await fetch(url, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, hostWallet: hostWalletAddress || undefined }),
    });
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
    setBusy(false);
    if (!res.ok) {
      setMsg(data.error ?? "Request failed");
      return;
    }
    setMsg("Done.");
    onChanged();
  }

  if (!link) {
    return (
      <div className="text-[10px] text-slate-500 border border-slate-800 rounded px-2 py-1" data-testid="broadcast-calendar-unlinked">
        No external calendar link — use Import from Google below or link manually.
      </div>
    );
  }

  return (
    <div className="text-[10px] space-y-1 border border-slate-700/80 rounded px-2 py-1.5 bg-slate-950/40" data-testid="broadcast-calendar-link-card">
      <div className="text-slate-400">
        <span className="text-slate-500">Provider:</span> {link.provider.replace(/_/g, " ")} ·{" "}
        <span className="text-slate-500">mode:</span> {link.syncMode}
      </div>
      {link.lastSyncedAt ? (
        <div className="text-slate-500">Last synced: {new Date(link.lastSyncedAt).toLocaleString()}</div>
      ) : null}
      {link.externalEventUrl ? (
        <a href={link.externalEventUrl} target="_blank" rel="noreferrer" className="text-sky-400 underline block truncate">
          External calendar
        </a>
      ) : null}
      <div className="flex flex-wrap gap-1 pt-0.5">
        <button
          type="button"
          disabled={busy}
          className="px-2 py-0.5 rounded bg-slate-700 text-slate-100 disabled:opacity-40"
          onClick={() => void post("/api/meet/broadcast/calendar/sync", { broadcastEventId })}
        >
          Sync now
        </button>
        <button
          type="button"
          disabled={busy}
          className="px-2 py-0.5 rounded bg-slate-700 text-slate-100 disabled:opacity-40"
          onClick={() => void post("/api/meet/broadcast/calendar/export", { broadcastEventId })}
        >
          Export / update Google
        </button>
        <button
          type="button"
          disabled={busy}
          className="px-2 py-0.5 rounded bg-slate-800 text-amber-200/90 disabled:opacity-40"
          onClick={() => {
            if (!confirm("Remove calendar link? The broadcast event stays in Troo.")) return;
            void post("/api/meet/broadcast/calendar/unlink", { broadcastEventId });
          }}
        >
          Unlink
        </button>
      </div>
      {msg ? <div className="text-slate-400">{msg}</div> : null}
    </div>
  );
}
