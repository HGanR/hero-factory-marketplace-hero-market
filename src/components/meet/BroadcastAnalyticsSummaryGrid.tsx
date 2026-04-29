"use client";

import React from "react";

export type BroadcastAnalyticsDashboardSummaryUi = {
    totalSessions: number;
    liveSessions: number;
    completedSessions: number;
    averageDurationSeconds: number | null;
    totalDestinationsUsed: number;
    totalFailedDestinations: number;
    degradedSessionCount: number;
    v2SessionCount: number;
    v2FallbackCount: number;
    autoDirectingApplyCount: number;
    scheduleActionCount: number;
    overlayChangeCount: number;
    liveSceneChangeCount: number;
    broadcastEventLinkedCount: number;
    calendarLinkedCount: number;
};

export type BroadcastAnalyticsSummaryGridProps = {
  summary: BroadcastAnalyticsDashboardSummaryUi;
  sessionSampleSize: number;
  sessionsTruncated: boolean;
};

function Card({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded border border-slate-700/80 bg-slate-950/60 px-2 py-1.5 min-w-[100px] flex-1">
      <div className="text-[9px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className="text-sm font-semibold text-slate-100 tabular-nums">{value}</div>
    </div>
  );
}

export function BroadcastAnalyticsSummaryGrid({ summary, sessionSampleSize, sessionsTruncated }: BroadcastAnalyticsSummaryGridProps) {
  return (
    <div className="space-y-1" data-testid="broadcast-analytics-summary-grid">
      {sessionsTruncated ? (
        <p className="text-[10px] text-amber-200/90">
          Sample capped at {sessionSampleSize} sessions (oldest in range may be omitted). Narrow filters or shorten the range.
        </p>
      ) : (
        <p className="text-[10px] text-slate-500">Sessions in sample: {sessionSampleSize}</p>
      )}
      <div className="flex flex-wrap gap-1.5">
        <Card label="Total sessions" value={summary.totalSessions} />
        <Card label="Live now" value={summary.liveSessions} />
        <Card label="Not live" value={summary.completedSessions} />
        <Card label="Avg duration (s)" value={summary.averageDurationSeconds ?? "—"} />
        <Card label="Destinations" value={summary.totalDestinationsUsed} />
        <Card label="Failed dest." value={summary.totalFailedDestinations} />
        <Card label="Degraded sessions" value={summary.degradedSessionCount} />
        <Card label="V2 sessions" value={summary.v2SessionCount} />
        <Card label="V2 fallback" value={summary.v2FallbackCount} />
        <Card label="AD applies" value={summary.autoDirectingApplyCount} />
        <Card label="Schedule actions" value={summary.scheduleActionCount} />
        <Card label="Overlay changes" value={summary.overlayChangeCount} />
        <Card label="Live scene chg." value={summary.liveSceneChangeCount} />
        <Card label="Event-linked" value={summary.broadcastEventLinkedCount} />
        <Card label="Calendar-linked" value={summary.calendarLinkedCount} />
      </div>
    </div>
  );
}
