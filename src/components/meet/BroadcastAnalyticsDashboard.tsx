"use client";

import React, { useCallback, useEffect, useState } from "react";
import { BroadcastAnalyticsBreakdownList, type BreakdownsPayload } from "./BroadcastAnalyticsBreakdownList";
import { BroadcastAnalyticsFiltersBar, type BroadcastAnalyticsFiltersBarValue } from "./BroadcastAnalyticsFiltersBar";
import {
  BroadcastAnalyticsSummaryGrid,
  type BroadcastAnalyticsDashboardSummaryUi,
} from "./BroadcastAnalyticsSummaryGrid";
import { MeetBroadcastTimelinePanel } from "./MeetBroadcastTimelinePanel";

type DashboardJson = {
  ok?: boolean;
  summary?: BroadcastAnalyticsDashboardSummaryUi;
  breakdowns?: BreakdownsPayload;
  generatedAt?: string;
  sessionsTruncated?: boolean;
  sessionSampleSize?: number;
  recentSessions?: Array<{
    sessionId: number;
    roomId: string;
    userId: number;
    startedAt: string | null;
    endedAt: string | null;
    finalStatus: string;
    broadcastEventId: number | null;
    compositorMode: string;
  }>;
  code?: string;
  error?: string;
};

function defaultFilterValue(): BroadcastAnalyticsFiltersBarValue {
  return {
    range: "last_30_days",
    fromIso: "",
    toIso: "",
    compositorMode: "",
    roomId: "",
    broadcastEventLinked: "",
    calendarLinked: "",
  };
}

function buildQuery(hostWallet: string, v: BroadcastAnalyticsFiltersBarValue): string {
  const q = new URLSearchParams();
  if (hostWallet) q.set("hostWallet", hostWallet);
  q.set("range", v.range);
  if (v.range === "custom") {
    if (v.fromIso.trim()) q.set("fromIso", v.fromIso.trim());
    if (v.toIso.trim()) q.set("toIso", v.toIso.trim());
  }
  if (v.compositorMode.trim()) q.set("compositorMode", v.compositorMode.trim());
  if (v.roomId.trim()) q.set("roomId", v.roomId.trim());
  if (v.broadcastEventLinked) q.set("broadcastEventLinked", v.broadcastEventLinked);
  if (v.calendarLinked) q.set("calendarLinked", v.calendarLinked);
  return q.toString();
}

export function BroadcastAnalyticsDashboard({
  hostWalletAddress,
  expandKey = 0,
}: {
  hostWalletAddress: string;
  /** Increment from parent to expand and refresh (e.g. status panel shortcut). */
  expandKey?: number;
}) {
  const [open, setOpen] = useState(false);
  const [filterValue, setFilterValue] = useState<BroadcastAnalyticsFiltersBarValue>(defaultFilterValue);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [summary, setSummary] = useState<BroadcastAnalyticsDashboardSummaryUi | null>(null);
  const [breakdowns, setBreakdowns] = useState<BreakdownsPayload | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [sessionsTruncated, setSessionsTruncated] = useState(false);
  const [sessionSampleSize, setSessionSampleSize] = useState(0);
  const [recentSessions, setRecentSessions] = useState<DashboardJson["recentSessions"]>([]);
  const [timelineDrillId, setTimelineDrillId] = useState<number | null>(null);
  const [launchHint, setLaunchHint] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void (async () => {
      const q = new URLSearchParams({
        ...(hostWalletAddress ? { hostWallet: hostWalletAddress } : {}),
        horizonHours: "72",
        maxEvents: "20",
      });
      const res = await fetch(`/api/meet/broadcast/readiness/upcoming?${q}`, { credentials: "include" });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        reports?: Array<{ overallStatus: string }>;
      };
      if (cancelled || !data.ok || !Array.isArray(data.reports)) {
        setLaunchHint(null);
        return;
      }
      const blocked = data.reports.filter((r) => r.overallStatus === "blocked").length;
      const att = data.reports.filter((r) => r.overallStatus === "attention_needed").length;
      if (blocked + att > 0) {
        setLaunchHint(`${blocked} launch blocked · ${att} need attention (upcoming 72h)`);
      } else {
        setLaunchHint(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, hostWalletAddress]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setCode(null);
    try {
      const qs = buildQuery(hostWalletAddress, filterValue);
      const res = await fetch(`/api/meet/broadcast/analytics/dashboard?${qs}`, { credentials: "include" });
      const data = (await res.json().catch(() => ({}))) as DashboardJson;
      if (!res.ok || !data.ok) {
        setError(String(data.error ?? "Dashboard request failed"));
        setCode(data.code ?? null);
        setSummary(null);
        setBreakdowns(null);
        return;
      }
      if (data.summary && data.breakdowns) {
        setSummary(data.summary);
        setBreakdowns(data.breakdowns);
        setGeneratedAt(data.generatedAt ?? null);
        setSessionsTruncated(Boolean(data.sessionsTruncated));
        setSessionSampleSize(data.sessionSampleSize ?? 0);
        setRecentSessions(data.recentSessions ?? []);
      }
    } catch {
      setError("Network error");
      setSummary(null);
      setBreakdowns(null);
    } finally {
      setLoading(false);
    }
  }, [hostWalletAddress, filterValue]);

  useEffect(() => {
    if (expandKey <= 0) return;
    setOpen(true);
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- parent-driven expand only; use latest load from this render
  }, [expandKey]);

  const scrollToEvents = () => {
    document.getElementById("meet-broadcast-events-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="mt-2 border border-slate-700/80 rounded-md overflow-hidden" data-testid="broadcast-analytics-dashboard">
      <button
        type="button"
        onClick={() => {
          const next = !open;
          setOpen(next);
          if (next && !summary) void load();
        }}
        className="w-full text-left text-[11px] px-2 py-1.5 bg-slate-800/60 text-slate-200 hover:bg-slate-800"
      >
        {open ? "▼" : "▶"} Cross-session analytics dashboard
      </button>
      {open ? (
        <div className="p-2 space-y-2 bg-slate-950/40">
          <p className="text-[10px] text-slate-500 leading-snug">
            Operational aggregates from your broadcast sessions and timeline (bounded sample). Not a full BI warehouse.
          </p>
          {launchHint ? (
            <div className="flex flex-wrap items-center gap-2 text-[10px] text-amber-200/90 border border-amber-800/40 rounded px-2 py-1 bg-amber-950/20">
              <span>Scheduled events: {launchHint}</span>
              <button type="button" className="text-sky-400 hover:underline" onClick={() => scrollToEvents()}>
                Open events & readiness
              </button>
            </div>
          ) : null}
          <BroadcastAnalyticsFiltersBar value={filterValue} onChange={setFilterValue} onApply={() => void load()} loading={loading} />
          {error ? (
            <p className="text-[11px] text-red-300">
              {error}
              {code ? <span className="block font-mono text-[10px] text-red-400/80">{code}</span> : null}
            </p>
          ) : null}
          {generatedAt ? <p className="text-[10px] text-slate-500">Generated {new Date(generatedAt).toLocaleString()}</p> : null}
          {summary ? (
            <BroadcastAnalyticsSummaryGrid
              summary={summary}
              sessionSampleSize={sessionSampleSize}
              sessionsTruncated={sessionsTruncated}
            />
          ) : null}
          {breakdowns ? <BroadcastAnalyticsBreakdownList breakdowns={breakdowns} /> : null}
          {recentSessions && recentSessions.length > 0 ? (
            <div className="space-y-1">
              <div className="text-[10px] uppercase tracking-wide text-slate-500">Recent in sample (drill-down)</div>
              <ul className="space-y-1 text-[10px]">
                {recentSessions.map((s) => (
                  <li
                    key={s.sessionId}
                    className="flex flex-wrap items-center gap-2 border border-slate-800 rounded px-1.5 py-1 bg-slate-900/50"
                  >
                    <span className="text-slate-300 font-mono">#{s.sessionId}</span>
                    <span className="text-slate-500">{s.roomId}</span>
                    <span className="text-slate-400">{s.finalStatus}</span>
                    <button
                      type="button"
                      className="text-sky-400 hover:underline"
                      onClick={() => setTimelineDrillId((id) => (id === s.sessionId ? null : s.sessionId))}
                    >
                      {timelineDrillId === s.sessionId ? "Hide timeline" : "Timeline & analytics"}
                    </button>
                    {s.broadcastEventId != null ? (
                      <button type="button" className="text-sky-400 hover:underline" onClick={() => scrollToEvents()}>
                        Broadcast events panel
                      </button>
                    ) : null}
                    {timelineDrillId === s.sessionId ? (
                      <div className="w-full mt-1">
                        <MeetBroadcastTimelinePanel broadcastSessionId={s.sessionId} hostWalletAddress={hostWalletAddress} />
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
