"use client";

import React, { useCallback, useState } from "react";
import { BroadcastAnalyticsSummaryCard, type BroadcastAnalyticsSummaryUi } from "./BroadcastAnalyticsSummaryCard";
import { BroadcastTimelineEventList, type TimelineEventRow } from "./BroadcastTimelineEventList";

type TimelineApiSummary = {
  totalEvents: number;
  countsByType: Record<string, number>;
  firstEventAtIso: string | null;
  lastEventAtIso: string | null;
};

async function parseJson(res: Response): Promise<Record<string, unknown>> {
  const t = await res.text();
  try {
    return JSON.parse(t) as Record<string, unknown>;
  } catch {
    return {};
  }
}

/**
 * Operator drill-down: full analytics + ordered timeline (loaded on expand to avoid extra traffic).
 */
export function MeetBroadcastTimelinePanel({
  broadcastSessionId,
  hostWalletAddress,
  onRefresh,
  onTimelineMutated,
}: {
  broadcastSessionId: number;
  hostWalletAddress: string;
  /** Optional — e.g. parent `refreshStatus` after actions that append timeline rows. */
  onRefresh?: () => void;
  /** @deprecated Prefer `onRefresh` — same callback, alternate name used by MeetBroadcastControls. */
  onTimelineMutated?: () => void;
}) {
  const parentRefresh = onRefresh ?? onTimelineMutated;
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [events, setEvents] = useState<TimelineEventRow[]>([]);
  const [summary, setSummary] = useState<TimelineApiSummary | null>(null);
  const [analytics, setAnalytics] = useState<BroadcastAnalyticsSummaryUi | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const q = new URLSearchParams({
      broadcastSessionId: String(broadcastSessionId),
      ...(hostWalletAddress ? { hostWallet: hostWalletAddress } : {}),
    });
    try {
      const [tRes, aRes] = await Promise.all([
        fetch(`/api/meet/broadcast/timeline?${q}&limit=200`, { credentials: "include" }),
        fetch(`/api/meet/broadcast/analytics?${q}`, { credentials: "include" }),
      ]);
      const tData = await parseJson(tRes);
      const aData = await parseJson(aRes);
      if (!tRes.ok) {
        setError(String(tData.error ?? "Timeline request failed"));
        setEvents([]);
        setSummary(null);
      } else {
        setEvents((tData.events as TimelineEventRow[]) ?? []);
        setSummary((tData.summary as TimelineApiSummary) ?? null);
      }
      if (aRes.ok && aData.analytics && typeof aData.analytics === "object") {
        setAnalytics(aData.analytics as BroadcastAnalyticsSummaryUi);
      } else if (!aRes.ok) {
        setAnalytics(null);
      }
    } catch {
      setError("Network error");
      setEvents([]);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [broadcastSessionId, hostWalletAddress]);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && events.length === 0 && !loading) void load();
  };

  return (
    <div className="mt-2 border border-slate-700/80 rounded-md overflow-hidden" data-testid="meet-broadcast-timeline-panel">
      <button
        type="button"
        onClick={() => toggle()}
        className="w-full text-left text-[11px] px-2 py-1.5 bg-slate-800/60 text-slate-200 hover:bg-slate-800"
      >
        {open ? "▼" : "▶"} Broadcast timeline &amp; analytics
      </button>
      {open ? (
        <div className="p-2 space-y-2 bg-slate-950/40">
          <div className="flex gap-2 flex-wrap">
            <button
              type="button"
              disabled={loading}
              onClick={() => void load()}
              className="text-[10px] px-2 py-0.5 rounded bg-slate-700 text-slate-100 disabled:opacity-40"
            >
              {loading ? "Loading…" : "Reload"}
            </button>
            {parentRefresh ? (
              <button
                type="button"
                onClick={() => parentRefresh()}
                className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300"
              >
                Refresh status
              </button>
            ) : null}
          </div>
          {error ? <p className="text-[11px] text-red-300">{error}</p> : null}
          <BroadcastAnalyticsSummaryCard analytics={analytics} />
          {summary ? (
            <p className="text-[10px] text-slate-500">
              Timeline aggregate: {summary.totalEvents} total
              {summary.firstEventAtIso ? ` · first ${new Date(summary.firstEventAtIso).toLocaleString()}` : ""}
            </p>
          ) : null}
          <div className="text-[10px] text-slate-500 uppercase tracking-wide">Events (oldest → newest)</div>
          <BroadcastTimelineEventList events={events} />
        </div>
      ) : null}
    </div>
  );
}
