"use client";

import React from "react";

export type UpcomingBroadcastEventRow = {
  id: number;
  title: string;
  scheduledStartIso: string;
  status: string;
  roomId: string | null;
  scenePresetId: number | null;
  defaultTimelineTemplateId: number | null;
  showPackageId: number | null;
  calendarLink?: {
    provider: string;
    syncMode: string;
    externalEventUrl: string | null;
    lastSyncedAt: string | null;
  } | null;
};

export function BroadcastUpcomingEventsCard({
  events,
  busyEventId,
  launchDisabled,
  onPrepareLaunch,
  onLaunch,
}: {
  events: UpcomingBroadcastEventRow[];
  busyEventId: number | null;
  launchDisabled: boolean;
  onPrepareLaunch: (id: number) => void;
  onLaunch: (id: number) => void;
}) {
  if (!events.length) {
    return (
      <p className="text-[10px] text-slate-500" data-testid="broadcast-upcoming-empty">
        No upcoming broadcast events (drafts with future starts appear when you create them).
      </p>
    );
  }

  return (
    <ul className="space-y-2 max-h-40 overflow-y-auto" data-testid="broadcast-upcoming-list">
      {events.map((e) => (
        <li
          key={e.id}
          className="rounded border border-slate-700/80 bg-slate-950/50 px-2 py-1.5 text-[11px] text-slate-200"
          data-testid={`broadcast-upcoming-row-${e.id}`}
        >
          <div className="font-medium text-slate-100">{e.title}</div>
          <div className="text-slate-500 text-[10px]">
            {new Date(e.scheduledStartIso).toLocaleString()}
            {e.roomId ? (
              <span>
                {" "}
                · room <code className="text-slate-400">{e.roomId}</code>
              </span>
            ) : null}
            {e.defaultTimelineTemplateId != null ? <span> · timeline template linked</span> : null}
            {e.showPackageId != null ? <span> · show package linked</span> : null}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">Status: {e.status}</div>
          {e.calendarLink ? (
            <div className="text-[10px] text-sky-400/90 mt-0.5">
              Calendar: {e.calendarLink.provider.replace(/_/g, " ")} · {e.calendarLink.syncMode}
              {e.calendarLink.externalEventUrl ? (
                <>
                  {" "}
                  ·{" "}
                  <a
                    href={e.calendarLink.externalEventUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="underline text-sky-300"
                  >
                    Open external
                  </a>
                </>
              ) : null}
            </div>
          ) : null}
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            <button
              type="button"
              disabled={busyEventId === e.id}
              className="text-[10px] px-2 py-0.5 rounded bg-slate-700 hover:bg-slate-600 disabled:opacity-40"
              onClick={() => onPrepareLaunch(e.id)}
            >
              {busyEventId === e.id ? "…" : "Prepare launch"}
            </button>
            <button
              type="button"
              disabled={launchDisabled || busyEventId === e.id}
              className="text-[10px] px-2 py-0.5 rounded bg-emerald-800/80 hover:bg-emerald-700/80 disabled:opacity-40"
              onClick={() => onLaunch(e.id)}
            >
              Start from event
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
