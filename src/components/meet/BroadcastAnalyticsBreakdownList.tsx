"use client";

import React from "react";

function kvBlock(title: string, data: Record<string, number> | { day: string; count: number }[]) {
  if (Array.isArray(data)) {
    if (data.length === 0) return null;
    return (
      <div className="space-y-0.5">
        <div className="text-[10px] uppercase tracking-wide text-slate-500">{title}</div>
        <ul className="text-[10px] text-slate-300 space-y-0.5 max-h-28 overflow-y-auto">
          {data.map((row) => (
            <li key={row.day} className="flex justify-between gap-2 border-b border-slate-800/80 pb-0.5">
              <span className="text-slate-400 font-mono">{row.day}</span>
              <span className="tabular-nums">{row.count}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  }
  const keys = Object.keys(data);
  if (keys.length === 0) return null;
  return (
    <div className="space-y-0.5">
      <div className="text-[10px] uppercase tracking-wide text-slate-500">{title}</div>
      <ul className="text-[10px] text-slate-300 space-y-0.5 max-h-28 overflow-y-auto">
        {keys
          .sort((a, b) => (data[b] ?? 0) - (data[a] ?? 0))
          .map((k) => (
            <li key={k} className="flex justify-between gap-2 border-b border-slate-800/80 pb-0.5">
              <span className="text-slate-400 break-all">{k}</span>
              <span className="tabular-nums shrink-0">{data[k]}</span>
            </li>
          ))}
      </ul>
    </div>
  );
}

export type BreakdownsPayload = {
  sessionsByDay: { day: string; count: number }[];
  sessionsByCompositorMode: Record<string, number>;
  sessionsByFinalStatus: Record<string, number>;
  destinationFailuresByPlatform: Record<string, number>;
  eventLinkedVsManual: { linked: number; manual: number };
  calendarLinkedVsUnlinked: { linked: number; unlinked: number };
  autoDirectingModeUsage: Record<string, number>;
  timelineTemplateUsage: Record<string, number>;
  averageDurationByCompositorMode: Record<string, number>;
};

export function BroadcastAnalyticsBreakdownList({ breakdowns }: { breakdowns: BreakdownsPayload }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]" data-testid="broadcast-analytics-breakdown-list">
      {kvBlock("Sessions by day", breakdowns.sessionsByDay)}
      {kvBlock("By compositor mode", breakdowns.sessionsByCompositorMode)}
      {kvBlock("By final status", breakdowns.sessionsByFinalStatus)}
      {kvBlock("Destination failures by platform", breakdowns.destinationFailuresByPlatform)}
      <div className="space-y-0.5">
        <div className="text-[10px] uppercase tracking-wide text-slate-500">Event vs manual</div>
        <div className="text-[10px] text-slate-300">
          Linked: {breakdowns.eventLinkedVsManual.linked} · Manual: {breakdowns.eventLinkedVsManual.manual}
        </div>
      </div>
      <div className="space-y-0.5">
        <div className="text-[10px] uppercase tracking-wide text-slate-500">Calendar (event-linked subset)</div>
        <div className="text-[10px] text-slate-300">
          With link: {breakdowns.calendarLinkedVsUnlinked.linked} · Without: {breakdowns.calendarLinkedVsUnlinked.unlinked}
        </div>
      </div>
      {kvBlock("Auto-directing mode (persisted)", breakdowns.autoDirectingModeUsage)}
      {kvBlock("Timeline template usage", breakdowns.timelineTemplateUsage)}
      {kvBlock("Avg duration by compositor (s)", breakdowns.averageDurationByCompositorMode)}
    </div>
  );
}
