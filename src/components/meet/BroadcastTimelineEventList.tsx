"use client";

import React from "react";

export type TimelineEventRow = {
  id: number;
  eventType: string;
  eventAtIso: string;
  summary: string;
  detailsJson?: Record<string, unknown> | null;
};

export function BroadcastTimelineEventList({ events }: { events: TimelineEventRow[] }) {
  if (events.length === 0) {
    return <p className="text-[11px] text-slate-500">No timeline rows yet.</p>;
  }
  return (
    <ul className="space-y-1.5 max-h-48 overflow-y-auto text-[11px]" data-testid="broadcast-timeline-event-list">
      {events.map((e) => (
        <li
          key={e.id}
          className="border border-slate-800/80 rounded px-2 py-1 bg-slate-950/60"
          data-testid={`broadcast-timeline-row-${e.id}`}
        >
          <div className="text-slate-500 font-mono text-[10px]">
            {new Date(e.eventAtIso).toLocaleString()} · <span className="text-sky-300/90">{e.eventType}</span>
          </div>
          <div className="text-slate-200 mt-0.5">{e.summary}</div>
        </li>
      ))}
    </ul>
  );
}
