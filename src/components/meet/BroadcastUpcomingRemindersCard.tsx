"use client";

import React, { useCallback, useEffect, useState } from "react";
import type { BroadcastReminderItem } from "@/lib/meet/broadcast-reminders";

async function parseJson(res: Response): Promise<Record<string, unknown>> {
  try {
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export function BroadcastUpcomingRemindersCard({
  hostWalletAddress,
  compact,
}: {
  hostWalletAddress: string;
  compact?: boolean;
}) {
  const [items, setItems] = useState<BroadcastReminderItem[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    const q = new URLSearchParams({
      ...(hostWalletAddress ? { hostWallet: hostWalletAddress } : {}),
      horizonHours: "48",
    });
    const res = await fetch(`/api/meet/broadcast/reminders?${q}`, { credentials: "include" });
    const data = await parseJson(res);
    if (!res.ok) {
      setErr(String(data.error ?? "Failed to load reminders"));
      setItems([]);
    } else {
      setItems((data.reminders as BroadcastReminderItem[]) ?? []);
    }
    setLoading(false);
  }, [hostWalletAddress]);

  useEffect(() => {
    void load();
  }, [load]);

  if (compact && items.length === 0 && !err && !loading) return null;

  return (
    <div
      className="rounded border border-slate-700/80 bg-slate-950/50 px-2 py-1.5 space-y-1"
      data-testid="broadcast-upcoming-reminders-card"
    >
      <div className="flex justify-between items-center gap-2">
        <span className="text-[10px] uppercase tracking-wide text-slate-500">Upcoming reminders</span>
        <button type="button" className="text-[10px] text-sky-400 hover:underline" onClick={() => void load()}>
          {loading ? "…" : "Refresh"}
        </button>
      </div>
      {err ? <p className="text-[10px] text-red-300">{err}</p> : null}
      {!items.length && !err ? (
        <p className="text-[10px] text-slate-500">No reminders in the next 48h (computed on refresh).</p>
      ) : (
        <ul className="text-[10px] text-slate-300 space-y-1 max-h-32 overflow-y-auto">
          {items.slice(0, compact ? 4 : 12).map((r) => (
            <li key={r.id} className="border-b border-slate-800/80 pb-1">
              <span className="text-slate-500 font-mono text-[9px]">{r.reminderType.replace(/_/g, " ")}</span>
              <div>{r.summary}</div>
              {r.detail && !compact ? <div className="text-slate-500">{r.detail}</div> : null}
            </li>
          ))}
        </ul>
      )}
      <p className="text-[9px] text-slate-600">Server computes reminders each load — nothing is auto-sent.</p>
    </div>
  );
}
