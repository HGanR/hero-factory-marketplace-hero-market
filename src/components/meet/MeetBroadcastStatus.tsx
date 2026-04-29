"use client";

import React from "react";
import type {
  BroadcastAutoDirectingSummary,
  BroadcastScenePreview,
  BroadcastTimelinePreview,
  SessionDestinationStatus,
} from "@/hooks/useMeetBroadcast";
import { BroadcastProviderBadges } from "@/components/meet/BroadcastProviderBadges";
import { getProviderCapabilities } from "@/lib/streaming/provider-capabilities";

function pillClass(status: string): string {
  const s = status.toLowerCase();
  if (s === "active") return "bg-emerald-600/30 text-emerald-200 border-emerald-500/50";
  if (s === "starting" || s === "pending") return "bg-amber-600/30 text-amber-200 border-amber-500/50";
  if (s === "failed") return "bg-red-600/30 text-red-200 border-red-500/50";
  if (s === "ended") return "bg-slate-600/40 text-slate-300 border-slate-500/40";
  return "bg-slate-700 text-slate-200 border-slate-600";
}

const LANDSCAPE_SCENE_LAYOUTS = new Set(["gallery", "speaker", "screenshare_focus"]);

export function MeetBroadcastStatus({
  sessionStatus,
  destinations,
  layoutMode,
  degraded = false,
  scenePreview = null,
  broadcastRealtimeConnected = false,
  broadcastRealtimeUsePollingFallback = false,
  autoDirectingSummary = null,
  timelinePreview = null,
  onOpenAnalyticsDashboard,
}: {
  sessionStatus: string | null;
  destinations: SessionDestinationStatus[];
  layoutMode: string;
  /** True only when a `meet_broadcast_session_destinations` row is explicitly `failed` (never from missing data). */
  degraded?: boolean;
  scenePreview?: BroadcastScenePreview | null;
  /** V2 operator SSE connected (low-latency invalidation path active). */
  broadcastRealtimeConnected?: boolean;
  /** V2 template active but SSE not connected — rely on polling for freshness. */
  broadcastRealtimeUsePollingFallback?: boolean;
  autoDirectingSummary?: BroadcastAutoDirectingSummary | null;
  /** Durable timeline row count + latest event (from status poll). */
  timelinePreview?: BroadcastTimelinePreview | null;
  /** Opens the cross-session analytics dashboard in the broadcast panel. */
  onOpenAnalyticsDashboard?: () => void;
}) {
  if (!sessionStatus) return null;

  const portraitHint =
    layoutMode.includes("single") &&
    destinations.some((d) => getProviderCapabilities(d.platform).supportsPortrait)
      ? "Portrait orientation recommended for at least one destination — confirm preview on device."
      : null;

  const layoutOrientationWarn =
    scenePreview &&
    destinations.some((d) => getProviderCapabilities(d.platform).supportsPortrait) &&
    LANDSCAPE_SCENE_LAYOUTS.has(scenePreview.layoutMode)
      ? "Selected layout may not match provider orientation — confirm preview on device."
      : null;

  const portraitSafeWarn =
    scenePreview &&
    !scenePreview.portraitSafe &&
    destinations.some((d) => getProviderCapabilities(d.platform).supportsPortrait)
      ? "Portrait-safe framing is recommended for Instagram/TikTok."
      : null;

  return (
    <div className="mt-3 space-y-2" data-testid="meet-broadcast-status">
      {degraded ? (
        <p className="text-[11px] text-amber-200/95 border border-amber-600/40 rounded px-2 py-1.5 bg-amber-950/40">
          Live with errors: the database shows at least one destination row in <code className="text-amber-100">failed</code>{" "}
          state for this session. Other outputs may still be up — check provider dashboards. Future: tie this to egress
          webhooks so failures are recorded per URL reliably.
        </p>
      ) : null}
      {scenePreview ? (
        <div
          className="text-[11px] text-slate-300 border border-slate-700/80 rounded px-2 py-1.5 bg-slate-950/50 space-y-1"
          data-testid="meet-broadcast-scene-preview"
        >
          {scenePreview.broadcastEventSummary ? (
            <div
              className="text-[10px] text-slate-300 space-y-0.5 border-b border-slate-800 pb-1.5 mb-1"
              data-testid="meet-broadcast-event-summary"
            >
              <div className="text-slate-500 uppercase tracking-wide">Broadcast event</div>
              <div className="text-slate-100 font-medium">{scenePreview.broadcastEventSummary.title}</div>
              <div className="text-slate-500">
                Scheduled start: {new Date(scenePreview.broadcastEventSummary.scheduledStartIso).toLocaleString()}
              </div>
              {scenePreview.broadcastEventSummary.timelineTemplateName ? (
                <div className="text-slate-500">
                  Timeline template: {scenePreview.broadcastEventSummary.timelineTemplateName}
                </div>
              ) : null}
              <div className="text-slate-500">Event status: {scenePreview.broadcastEventSummary.status}</div>
              {scenePreview.broadcastEventSummary.calendarLink ? (
                <div className="text-sky-400/90" data-testid="meet-broadcast-calendar-summary">
                  Calendar: {scenePreview.broadcastEventSummary.calendarLink.provider.replace(/_/g, " ")} ·{" "}
                  {scenePreview.broadcastEventSummary.calendarLink.syncMode}
                  {scenePreview.broadcastEventSummary.calendarLink.lastSyncedAt ? (
                    <span className="text-slate-500">
                      {" "}
                      · synced {new Date(scenePreview.broadcastEventSummary.calendarLink.lastSyncedAt).toLocaleString()}
                    </span>
                  ) : null}
                  {scenePreview.broadcastEventSummary.calendarLink.externalEventUrl ? (
                    <>
                      {" "}
                      ·{" "}
                      <a
                        href={scenePreview.broadcastEventSummary.calendarLink.externalEventUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="underline text-sky-300"
                      >
                        external
                      </a>
                    </>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
          <div className="text-[10px] uppercase tracking-wide text-slate-500">Active program (V1)</div>
          <div>
            Layout: <code className="text-slate-200">{scenePreview.layoutMode}</code>
            {scenePreview.presetName ? (
              <span className="text-slate-500"> · preset: {scenePreview.presetName}</span>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-slate-400">
            <span>Portrait safe: {scenePreview.portraitSafe ? "on" : "off"}</span>
            <span>Branding: {scenePreview.brandingEnabled ? "on" : "off"}</span>
            <span>Screen-share priority: {scenePreview.screenSharePriority ? "on" : "off"}</span>
          </div>
          {scenePreview.compositorMode ? (
            <div
              className="text-[10px] text-slate-400 space-y-0.5 border-t border-slate-800 pt-1"
              data-testid="meet-broadcast-compositor-summary"
            >
              <div>
                Compositor:{" "}
                <code className="text-slate-200">
                  {scenePreview.compositorMode === "v2_rendered_template" ? "V2 rendered template" : "V1 LiveKit default"}
                </code>
                {scenePreview.templateActive ? (
                  <span className="ml-2 text-emerald-400">· template active</span>
                ) : null}
              </div>
              {scenePreview.renderSessionMasked ? (
                <div>
                  Render session: <code className="text-slate-300">{scenePreview.renderSessionMasked}</code>
                </div>
              ) : null}
              <div>
                Branding on stream: {scenePreview.brandingRendered ? "rendered (V2)" : "intent only / default chrome"}
              </div>
              {scenePreview.compositorFallbackFromV2 ? (
                <p className="text-amber-200/90">
                  V2 template was requested but the system fell back to the standard LiveKit composite — check template
                  origin env and logs.
                </p>
              ) : null}
              {scenePreview.templateActive && scenePreview.liveScene ? (
                <div
                  className="text-[10px] text-slate-300 space-y-0.5 border-t border-slate-800 pt-1"
                  data-testid="meet-broadcast-live-scene-summary"
                >
                  <div className="text-slate-500 uppercase tracking-wide">Live scene (operator)</div>
                  <div>
                    Scene: <code className="text-slate-200">{scenePreview.liveScene.sceneType}</code>
                    {scenePreview.liveScene.layoutMode ? (
                      <span className="text-slate-500">
                        {" "}
                        · layout: <code className="text-slate-300">{scenePreview.liveScene.layoutMode}</code>
                      </span>
                    ) : null}
                  </div>
                  {scenePreview.liveScene.updatedAt ? (
                    <div className="text-slate-500">
                      Last live update: {new Date(scenePreview.liveScene.updatedAt).toLocaleString()}
                    </div>
                  ) : (
                    <div className="text-slate-500">No persisted live overrides — program default from start snapshot.</div>
                  )}
                </div>
              ) : null}
              {scenePreview.templateActive && scenePreview.overlaySummary ? (
                <div
                  className="text-[10px] text-slate-300 space-y-0.5 border-t border-slate-800 pt-1"
                  data-testid="meet-broadcast-overlay-summary"
                >
                  <div className="text-slate-500 uppercase tracking-wide">Overlays</div>
                  <div className="text-slate-400">
                    Lower third: {scenePreview.overlaySummary.lowerThirdVisible ? "on" : "off"} · Ticker:{" "}
                    {scenePreview.overlaySummary.tickerVisible ? "on" : "off"} · CTA:{" "}
                    {scenePreview.overlaySummary.ctaBannerVisible ? "on" : "off"}
                  </div>
                  {scenePreview.overlaySummary.updatedAt ? (
                    <div className="text-slate-500">
                      Last overlay update: {new Date(scenePreview.overlaySummary.updatedAt).toLocaleString()}
                    </div>
                  ) : (
                    <div className="text-slate-500">No persisted overlay state.</div>
                  )}
                </div>
              ) : null}
              {scenePreview.templateActive ? (
                <div
                  className="text-[10px] text-slate-400 space-y-0.5 border-t border-slate-800 pt-1"
                  data-testid="meet-broadcast-realtime-status"
                >
                  <div className="text-slate-500 uppercase tracking-wide">Realtime</div>
                  <div data-testid="meet-broadcast-realtime-connected">
                    {broadcastRealtimeConnected ? "Connected" : "Not connected"}
                  </div>
                  <div data-testid="meet-broadcast-realtime-polling-fallback">
                    {broadcastRealtimeUsePollingFallback ? "Polling fallback active" : "—"}
                  </div>
                </div>
              ) : null}
              {scenePreview.templateActive ? (
                <div
                  className="text-[10px] text-slate-300 space-y-0.5 border-t border-slate-800 pt-1"
                  data-testid="meet-broadcast-auto-directing-summary"
                >
                  <div className="text-slate-500 uppercase tracking-wide">Auto-directing</div>
                  {autoDirectingSummary ? (
                    <>
                      <div className="text-slate-400">
                        Mode: <code className="text-sky-200">{autoDirectingSummary.mode}</code>
                        {autoDirectingSummary.manualOverrideActive ? (
                          <span className="text-amber-200/90"> · manual override</span>
                        ) : null}
                      </div>
                      <div className="text-slate-500">
                        Suggested layout:{" "}
                        <code className="text-slate-300">{autoDirectingSummary.latestRecommendedLayout ?? "—"}</code>
                      </div>
                    </>
                  ) : (
                    <div className="text-slate-500">Summary loads on next status poll.</div>
                  )}
                </div>
              ) : null}
              {scenePreview.templateActive && scenePreview.scheduleSummary ? (
                <div
                  className="text-[10px] text-slate-300 space-y-0.5 border-t border-slate-800 pt-1"
                  data-testid="meet-broadcast-schedule-summary"
                >
                  <div className="text-slate-500 uppercase tracking-wide">Schedule</div>
                  <div className="text-slate-400">
                    Automation: {scenePreview.scheduleSummary.automationEnabled ? "on" : "off"} · Countdown:{" "}
                    {scenePreview.scheduleSummary.countdownVisible ? "active" : "inactive"}
                  </div>
                  <div className="text-slate-500">
                    Next:{" "}
                    {scenePreview.scheduleSummary.nextScheduledActionAt
                      ? `${scenePreview.scheduleSummary.nextScheduledActionType ?? "?"} @ ${new Date(scenePreview.scheduleSummary.nextScheduledActionAt).toLocaleString()}`
                      : "—"}
                  </div>
                  <div className="text-slate-500">
                    Last executed:{" "}
                    <span className="font-mono text-slate-400">
                      {scenePreview.scheduleSummary.lastExecutedActionId ?? "—"}
                    </span>
                  </div>
                  {scenePreview.scheduleUpdatedAt ? (
                    <div className="text-slate-500">
                      Schedule row updated: {new Date(scenePreview.scheduleUpdatedAt).toLocaleString()}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
          <p className="text-[10px] text-slate-500 leading-snug" data-testid="meet-broadcast-scene-v1-operator-note">
            {scenePreview.compositorMode === "v2_rendered_template" && scenePreview.templateActive
              ? "V2 uses the custom /meet/broadcast-template page for program chrome; layout still follows LiveKit room composite rules."
              : "Scene controls store intent; V1 output uses standard LiveKit composites unless V2 template is active."}
          </p>
        </div>
      ) : null}
      {timelinePreview != null && timelinePreview.eventCount > 0 ? (
        <div
          className="text-[10px] text-slate-300 border border-slate-700/80 rounded px-2 py-1.5 bg-slate-950/50 space-y-0.5"
          data-testid="meet-broadcast-timeline-preview"
        >
          <div className="text-slate-500 uppercase tracking-wide">Session timeline</div>
          <div className="text-slate-400">
            {timelinePreview.eventCount} event{timelinePreview.eventCount === 1 ? "" : "s"} recorded
          </div>
          {timelinePreview.latestEvent ? (
            <div className="text-slate-500">
              Latest: <code className="text-slate-300">{timelinePreview.latestEvent.eventType}</code> —{" "}
              {timelinePreview.latestEvent.summary}
              <span className="text-slate-600">
                {" "}
                ({new Date(timelinePreview.latestEvent.eventAtIso).toLocaleTimeString()})
              </span>
            </div>
          ) : null}
        </div>
      ) : null}
      {onOpenAnalyticsDashboard ? (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => onOpenAnalyticsDashboard()}
            className="text-[10px] px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-sky-300"
            data-testid="meet-broadcast-open-dashboard"
          >
            View cross-session dashboard
          </button>
        </div>
      ) : null}
      <div className="text-xs text-slate-400 uppercase tracking-wide">Broadcast output</div>
      <div className="flex flex-wrap gap-2">
        {destinations.map((d) => (
          <div
            key={d.id}
            title={d.resolvedOutputUrlMasked}
            className={`text-xs px-2 py-1 rounded border ${pillClass(d.status)}`}
            data-testid={`meet-broadcast-dest-pill-${d.id}`}
          >
            <span className="font-medium">{d.label || d.platform}</span>
            <span className="opacity-80"> · {d.status}</span>
            {d.streamDestinationId == null ? (
              <span className="block text-[10px] text-sky-200/90 mt-0.5">One-time · not saved</span>
            ) : null}
            <div className="mt-1">
              <BroadcastProviderBadges platform={d.platform} compact />
            </div>
            {d.lastError ? (
              <span className="block text-red-300/90 mt-0.5 max-w-[220px] truncate">{d.lastError}</span>
            ) : null}
          </div>
        ))}
        {destinations.length === 0 ? (
          <span className="text-xs text-slate-500">No destination rows for this session.</span>
        ) : null}
      </div>
      {portraitHint ? (
        <p className="text-xs text-amber-200/90" data-testid="meet-broadcast-orient-warning">
          {portraitHint}
        </p>
      ) : null}
      {layoutOrientationWarn ? (
        <p className="text-[11px] text-amber-200/85" data-testid="meet-broadcast-layout-orient-warn">
          {layoutOrientationWarn}
        </p>
      ) : null}
      {portraitSafeWarn ? (
        <p className="text-[11px] text-amber-200/85" data-testid="meet-broadcast-portrait-safe-warn">
          {portraitSafeWarn}
        </p>
      ) : null}
    </div>
  );
}
