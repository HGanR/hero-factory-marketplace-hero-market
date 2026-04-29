"use client";

import React, { useCallback, useEffect, useState } from "react";
import { BroadcastLaunchReadinessCard } from "./BroadcastLaunchReadinessCard";
import { BroadcastUpcomingRemindersCard } from "./BroadcastUpcomingRemindersCard";
import type { BroadcastLaunchReadinessReport } from "@/lib/meet/broadcast-launch-readiness";

async function parseJson(res: Response): Promise<Record<string, unknown>> {
  try {
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export function MeetBroadcastReadinessPanel({
  hostWalletAddress,
  onPrepareLaunch,
}: {
  hostWalletAddress: string;
  onPrepareLaunch: (eventId: number) => void;
}) {
  const [reports, setReports] = useState<BroadcastLaunchReadinessReport[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const scrollToEvents = () => {
    document.getElementById("meet-broadcast-events-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    const q = new URLSearchParams({
      ...(hostWalletAddress ? { hostWallet: hostWalletAddress } : {}),
      horizonHours: "168",
      maxEvents: "12",
    });
    const res = await fetch(`/api/meet/broadcast/readiness/upcoming?${q}`, { credentials: "include" });
    const data = await parseJson(res);
    if (!res.ok) {
      setErr(String(data.error ?? "Failed to load readiness"));
      setReports([]);
    } else {
      setReports((data.reports as BroadcastLaunchReadinessReport[]) ?? []);
    }
    setLoading(false);
  }, [hostWalletAddress]);

  useEffect(() => {
    void load();
  }, [load]);

  const blocked = reports.filter((r) => r.overallStatus === "blocked");
  const attention = reports.filter((r) => r.overallStatus === "attention_needed");
  const ready = reports.filter((r) => r.overallStatus === "ready");

  return (
    <div className="mt-2 space-y-2 border border-slate-700/60 rounded-md p-2 bg-slate-950/30" data-testid="meet-broadcast-readiness-panel">
      <div className="flex flex-wrap justify-between items-center gap-2">
        <span className="text-[10px] uppercase tracking-wide text-slate-500">Launch readiness & reminders</span>
        <div className="flex gap-2">
          <button type="button" className="text-[10px] text-sky-400 hover:underline" onClick={() => scrollToEvents()}>
            Go to broadcast events
          </button>
          <button type="button" className="text-[10px] text-slate-400 hover:underline" onClick={() => void load()}>
            {loading ? "…" : "Refresh readiness"}
          </button>
        </div>
      </div>
      {err ? <p className="text-[10px] text-red-300">{err}</p> : null}
      {blocked.length ? (
        <div className="space-y-1">
          <div className="text-[10px] text-red-400/90">Blocked ({blocked.length})</div>
          {blocked.map((r) => (
            <BroadcastLaunchReadinessCard
              key={r.broadcastEventId}
              report={r}
              onPrepareLaunch={onPrepareLaunch}
              compact={false}
            />
          ))}
        </div>
      ) : null}
      {attention.length ? (
        <div className="space-y-1">
          <div className="text-[10px] text-amber-300/90">Needs attention ({attention.length})</div>
          {attention.map((r) => (
            <BroadcastLaunchReadinessCard
              key={r.broadcastEventId}
              report={r}
              onPrepareLaunch={onPrepareLaunch}
              compact={false}
            />
          ))}
        </div>
      ) : null}
      {ready.length > 0 && !loading ? (
        <p className="text-[10px] text-emerald-400/80">
          {ready.length} upcoming event{ready.length === 1 ? "" : "s"} in range look ready.
        </p>
      ) : null}
      {!blocked.length && !attention.length && !ready.length && !loading ? (
        <p className="text-[10px] text-slate-500">No upcoming events in the next 7 days — or none scheduled.</p>
      ) : null}
      <BroadcastUpcomingRemindersCard hostWalletAddress={hostWalletAddress} />
    </div>
  );
}
