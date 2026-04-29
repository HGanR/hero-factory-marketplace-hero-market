"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useMeetBroadcast } from "@/hooks/useMeetBroadcast";
import { getDefaultSceneConfig, type BroadcastSceneConfig } from "@/lib/meet/broadcast-scene";
import { MeetDestinationsPanel } from "./MeetDestinationsPanel";
import { MeetBroadcastStatus } from "./MeetBroadcastStatus";
import { MeetBroadcastSceneControls } from "./MeetBroadcastSceneControls";
import { MeetBroadcastLiveSceneControls } from "./MeetBroadcastLiveSceneControls";
import { MeetBroadcastOverlayControls } from "./MeetBroadcastOverlayControls";
import { MeetBroadcastScheduleControls } from "./MeetBroadcastScheduleControls";
import { MeetBroadcastAutoDirectingControls } from "./MeetBroadcastAutoDirectingControls";
import { MeetBroadcastEventsPanel } from "./MeetBroadcastEventsPanel";
import { MeetBroadcastTimelinePanel } from "./MeetBroadcastTimelinePanel";
import { BroadcastAnalyticsDashboard } from "./BroadcastAnalyticsDashboard";
import { BroadcastUpcomingRemindersCard } from "./BroadcastUpcomingRemindersCard";
import { STREAM_PLATFORMS } from "@/lib/streaming/destinations";
import { BROADCAST_CODES } from "@/lib/meet/broadcast-codes";

const EPHEMERAL_IGNORED_IDEMPOTENT_COPY =
  "This broadcast was already live for you in this room — the existing egress kept running. The one-time RTMP credentials you entered were not applied. Stop broadcast, then start again with the new key, or use saved destinations for repeatable outputs.";

const RadioIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M5.636 18.364a9 9 0 010-12.728m12.728 0a9 9 0 010 12.728M8.464 8.464a5 5 0 017.072 7.072M12 12h.01"
    />
  </svg>
);

function BroadcastCollapsibleSection({
  title,
  subtitle,
  defaultOpen = false,
  children,
  contentClassName,
  "data-testid": dataTestId,
}: {
  title: string;
  subtitle?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
  /** Extra classes on the expanded body wrapper (padding etc.). */
  contentClassName?: string;
  "data-testid"?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div
      className="rounded-lg border border-slate-700/80 bg-slate-950/35 overflow-hidden"
      data-testid={dataTestId}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-start justify-between gap-2 px-2.5 py-2 text-left hover:bg-slate-800/45 transition-colors"
        aria-expanded={open}
      >
        <div className="min-w-0">
          <div className="text-[11px] font-semibold text-slate-200">{title}</div>
          {subtitle ? (
            <div className="text-[10px] text-slate-500 mt-0.5 leading-snug">{subtitle}</div>
          ) : null}
        </div>
        <svg
          className={`w-4 h-4 text-slate-400 shrink-0 mt-0.5 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open ? (
        <div className={`border-t border-slate-800/90 ${contentClassName ?? "px-2.5 py-2"}`}>{children}</div>
      ) : null}
    </div>
  );
}

type BroadcastContext = {
  identityEmailMasked?: string;
  linkedWalletMasked?: string | null;
  hostRule?: string;
  hostRuleDetail?: string;
} | null;

export function MeetBroadcastControls({
  roomId,
  layoutMode,
  hostWalletAddress,
}: {
  roomId: string;
  layoutMode: string;
  hostWalletAddress: string;
}) {
  // Roadmap: dedicated program/broadcast scene (speaker vs gallery, branding, portrait-safe framing) before adding more platforms.
  const [panelOpen, setPanelOpen] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [startWarnings, setStartWarnings] = useState<string[]>([]);
  const [ephemeralIgnoredNotice, setEphemeralIgnoredNotice] = useState<string | null>(null);
  const [ctx, setCtx] = useState<BroadcastContext>(null);
  const [sceneConfig, setSceneConfig] = useState<BroadcastSceneConfig>(() => getDefaultSceneConfig());
  /** When set, start uses `scenePresetId` only (cleared on any manual scene edit). */
  const [startScenePresetId, setStartScenePresetId] = useState<number | null>(null);
  const [dashboardExpandKey, setDashboardExpandKey] = useState(0);
  const [includeSavedDestinationsForStart, setIncludeSavedDestinationsForStart] = useState(true);
  const [ephemeralPlatform, setEphemeralPlatform] = useState<string>("instagram");
  const [ephemeralLabel, setEphemeralLabel] = useState("");
  const [ephemeralServerUrl, setEphemeralServerUrl] = useState("");
  const [ephemeralStreamKey, setEphemeralStreamKey] = useState("");

  const bc = useMeetBroadcast({ roomId, layoutMode, hostWalletAddress });

  const onSceneConfigChange = useCallback((next: BroadcastSceneConfig, meta?: { fromPresetId?: number }) => {
    setSceneConfig(next);
    if (meta?.fromPresetId != null) setStartScenePresetId(meta.fromPresetId);
    else setStartScenePresetId(null);
  }, []);

  const live =
    bc.session && (bc.session.status === "starting" || bc.session.status === "active");

  const activeDestinationCount = bc.destinations.filter((d) => d.isActive).length;
  const ephemeralStreamKeyTrimmed = ephemeralStreamKey.trim();
  const ephemeralReady = ephemeralStreamKeyTrimmed.length > 0;
  const savedOutputsSelected = includeSavedDestinationsForStart && activeDestinationCount > 0;
  const startBroadcastDisabled = actionBusy || (!savedOutputsSelected && !ephemeralReady);
  const startBroadcastDisabledTitle =
    !startBroadcastDisabled || actionBusy
      ? undefined
      : !savedOutputsSelected && !ephemeralReady
        ? "Include at least one active saved destination, or paste a stream key under One-time RTMP."
        : !bc.destinationsEncryptionConfigured &&
            includeSavedDestinationsForStart &&
            activeDestinationCount > 0 &&
            !ephemeralReady
          ? "Saved destinations need STREAM_DESTINATION_ENCRYPTION_KEY on the server — configure it, or uncheck “Include saved destinations” and use one-time RTMP only."
          : undefined;

  function clearEphemeralRtmpForm() {
    setEphemeralIgnoredNotice(null);
    setEphemeralPlatform("instagram");
    setEphemeralLabel("");
    setEphemeralServerUrl("");
    setEphemeralStreamKey("");
  }

  function buildStartDestinationOptions(): {
    savedDestinationIds?: number[];
    ephemeralRtmp?: { serverUrl: string; streamKey: string; platform?: string; label?: string };
  } {
    const out: {
      savedDestinationIds?: number[];
      ephemeralRtmp?: { serverUrl: string; streamKey: string; platform?: string; label?: string };
    } = {};
    if (!includeSavedDestinationsForStart) {
      out.savedDestinationIds = [];
    }
    if (ephemeralReady) {
      out.ephemeralRtmp = {
        serverUrl: ephemeralServerUrl.trim(),
        streamKey: ephemeralStreamKeyTrimmed,
        ...(ephemeralPlatform.trim() ? { platform: ephemeralPlatform.trim() } : {}),
        ...(ephemeralLabel.trim() ? { label: ephemeralLabel.trim() } : {}),
      };
    }
    return out;
  }

  useEffect(() => {
    if (!panelOpen) return;
    let cancelled = false;
    void fetch("/api/meet/broadcast/context", { credentials: "include" }).then(async (res) => {
      const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (cancelled) return;
      if (!res.ok) {
        setCtx({
          identityEmailMasked: "",
          linkedWalletMasked: null,
          hostRule: "",
          hostRuleDetail:
            res.status === 401
              ? "Sign in to Troo in this browser to manage broadcast destinations and start streams."
              : String(data.error ?? "Could not load broadcast account context."),
        });
        return;
      }
      setCtx({
        identityEmailMasked: String(data.identityEmailMasked ?? ""),
        linkedWalletMasked: (data.linkedWalletMasked as string | null) ?? null,
        hostRule: String(data.hostRule ?? ""),
        hostRuleDetail: String(data.hostRuleDetail ?? ""),
      });
    });
    return () => {
      cancelled = true;
    };
  }, [panelOpen]);

  async function handleStart() {
    setActionBusy(true);
    setStartWarnings([]);
    setEphemeralIgnoredNotice(null);
    const destOpts = buildStartDestinationOptions();
    const hadEphemeral = Boolean(destOpts.ephemeralRtmp);
    const r = await bc.startBroadcast({
      ...(startScenePresetId != null ? { scenePresetId: startScenePresetId } : { sceneConfig }),
      ...destOpts,
    });
    if (
      r.ok &&
      r.ephemeralRtmpIgnored &&
      hadEphemeral &&
      r.ephemeralRtmpIgnoredReason === BROADCAST_CODES.ephemeralIgnoredIdempotentActiveSession
    ) {
      setEphemeralIgnoredNotice(EPHEMERAL_IGNORED_IDEMPOTENT_COPY);
    }
    if (r.ok && hadEphemeral && !r.ephemeralRtmpIgnored) clearEphemeralRtmpForm();
    const merged = [...(r.sceneWarnings ?? []), ...(r.warnings ?? [])];
    setStartWarnings(merged);
    setActionBusy(false);
  }

  async function handleStartFromEvent(eventId: number) {
    setActionBusy(true);
    setStartWarnings([]);
    setEphemeralIgnoredNotice(null);
    const destOpts = buildStartDestinationOptions();
    const hadEphemeral = Boolean(destOpts.ephemeralRtmp);
    const r = await bc.startBroadcast({
      broadcastEventId: eventId,
      ...destOpts,
    });
    if (
      r.ok &&
      r.ephemeralRtmpIgnored &&
      hadEphemeral &&
      r.ephemeralRtmpIgnoredReason === BROADCAST_CODES.ephemeralIgnoredIdempotentActiveSession
    ) {
      setEphemeralIgnoredNotice(EPHEMERAL_IGNORED_IDEMPOTENT_COPY);
    }
    if (r.ok && hadEphemeral && !r.ephemeralRtmpIgnored) clearEphemeralRtmpForm();
    const merged = [...(r.sceneWarnings ?? []), ...(r.warnings ?? [])];
    setStartWarnings(merged);
    setActionBusy(false);
  }

  async function handleStop() {
    setActionBusy(true);
    await bc.stopBroadcast();
    clearEphemeralRtmpForm();
    setStartWarnings([]);
    setActionBusy(false);
  }

  async function handleDelete(id: number) {
    if (!confirm("Delete this destination?")) return;
    const res = await fetch(`/api/stream-destinations/${id}`, { method: "DELETE", credentials: "include" });
    if (res.ok) await bc.loadDestinations();
    else {
      bc.setError("Delete failed");
      bc.setErrorCode("broadcast_delete_failed");
    }
  }

  const connectedWalletShort = hostWalletAddress
    ? `${hostWalletAddress.slice(0, 6)}…${hostWalletAddress.slice(-4)}`
    : null;

  return (
    <div className="relative flex flex-col gap-1" data-testid="meet-broadcast-controls">
      <button
        type="button"
        onClick={() =>
          setPanelOpen((open) => {
            if (open) clearEphemeralRtmpForm();
            return !open;
          })
        }
        className="flex items-center gap-1.5 px-2 py-1 rounded bg-violet-700 hover:bg-violet-600 text-sm text-white"
        title="Multi-platform RTMP broadcast (host only)"
      >
        <RadioIcon />
        Broadcast
      </button>

      {panelOpen ? (
        <div className="absolute z-[100] top-full right-0 mt-1 w-[min(100vw-2rem,380px)] max-h-[min(78vh,620px)] overflow-y-auto overscroll-y-contain rounded-lg border border-slate-600 bg-slate-900/95 shadow-xl p-3 text-left">
          <BroadcastCollapsibleSection
            title="Account & privacy"
            subtitle="Who can start streams and how keys are handled"
            defaultOpen
            contentClassName="px-2.5 py-2 space-y-2"
          >
            {ctx ? (
              <div className="rounded border border-slate-700/80 bg-slate-950/60 px-2 py-1.5 text-[11px] text-slate-300 space-y-1">
                <div>
                  <span className="text-slate-500">Broadcast identity</span>
                  <div className="text-slate-200 font-medium">{ctx.identityEmailMasked || "—"}</div>
                </div>
                {ctx.linkedWalletMasked ? (
                  <div>
                    <span className="text-slate-500">Linked wallet on Troo</span>
                    <div className="text-slate-200 font-mono text-[10px]">{ctx.linkedWalletMasked}</div>
                  </div>
                ) : null}
                {connectedWalletShort ? (
                  <div>
                    <span className="text-slate-500">Wallet in this meeting</span>
                    <div className="text-slate-200 font-mono text-[10px]">{connectedWalletShort}</div>
                  </div>
                ) : (
                  <div className="text-amber-200/90">
                    No wallet connected in the browser — if your account requires a matching wallet, connect it before
                    starting broadcast.
                  </div>
                )}
                {ctx.hostRuleDetail ? (
                  <p className="text-slate-500 leading-snug border-t border-slate-800 pt-1 mt-1">{ctx.hostRuleDetail}</p>
                ) : null}
              </div>
            ) : (
              <p className="text-[10px] text-slate-500">Loading broadcast account context…</p>
            )}
            <p className="text-[11px] text-slate-400 leading-snug">
              Saved stream keys are encrypted on the server and are not sent back to this browser. One-time RTMP is sent
              only in the start request and is not stored. Start/stop uses your Troo session; see identity above for the
              wallet rule.
            </p>
          </BroadcastCollapsibleSection>

          <div className="mt-2 space-y-2">
            {bc.infoMessage ? (
              <p className="text-[11px] text-sky-200/95 border border-sky-800/50 rounded px-2 py-1 bg-sky-950/40">
                {bc.infoMessage}
              </p>
            ) : null}

            {bc.error ? (
              <p className="text-xs text-red-300">
                {bc.error}
                {bc.errorCode ? (
                  <span className="block text-[10px] text-red-400/80 mt-0.5 font-mono">{bc.errorCode}</span>
                ) : null}
              </p>
            ) : null}
          </div>

          <div className="mt-2 space-y-2">
            <BroadcastCollapsibleSection title="Upcoming reminders" subtitle="Optional — calendar nudges" defaultOpen={false}>
              <BroadcastUpcomingRemindersCard hostWalletAddress={hostWalletAddress} compact />
            </BroadcastCollapsibleSection>

            <BroadcastCollapsibleSection title="Saved destinations" subtitle="Encrypted keys on the server" defaultOpen>
              <MeetDestinationsPanel
                destinations={bc.destinations}
                loading={bc.loading}
                error={null}
                encryptionConfigured={bc.destinationsEncryptionConfigured}
                onSaved={() => void bc.loadDestinations()}
                onDelete={handleDelete}
                onTest={async (id) => {
                  const r = await bc.testDestination(id);
                  if (r?.warnings?.length) {
                    bc.setError(r.warnings.join(" "));
                    bc.setErrorCode("broadcast_test_warnings");
                  }
                }}
              />
            </BroadcastCollapsibleSection>

            <BroadcastCollapsibleSection
              title="One-time RTMP"
              subtitle="This session only — cleared after start or stop"
              defaultOpen
              contentClassName="px-2.5 py-2"
            >
              <div className="rounded border border-slate-700/70 bg-slate-950/55 px-2 py-2 space-y-2" data-testid="meet-broadcast-ephemeral-rtmp-section">
            <p className="text-[10px] text-slate-500 leading-snug">
              Paste a per-session server URL and stream key (e.g. Instagram). Nothing here is saved to your account —
              credentials are cleared after a successful start or when you stop broadcast.
            </p>
            <label className="flex items-start gap-2 text-[11px] text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                className="mt-0.5 rounded border-slate-600"
                checked={includeSavedDestinationsForStart}
                onChange={(e) => setIncludeSavedDestinationsForStart(e.target.checked)}
                data-testid="meet-broadcast-include-saved-destinations"
              />
              <span>
                Include saved destinations for this start
                {activeDestinationCount === 0 ? (
                  <span className="block text-slate-500">(none active — use one-time RTMP or add a saved row)</span>
                ) : null}
              </span>
            </label>
            <div className="grid gap-1.5">
              <label className="text-[10px] text-slate-500">
                Platform
                <select
                  value={ephemeralPlatform}
                  onChange={(e) => setEphemeralPlatform(e.target.value)}
                  className="mt-0.5 w-full text-[11px] bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200"
                  data-testid="meet-broadcast-ephemeral-platform"
                >
                  {STREAM_PLATFORMS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-[10px] text-slate-500">
                Label (optional)
                <input
                  value={ephemeralLabel}
                  onChange={(e) => setEphemeralLabel(e.target.value)}
                  placeholder="e.g. IG Live"
                  maxLength={120}
                  className="mt-0.5 w-full text-[11px] bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200"
                  data-testid="meet-broadcast-ephemeral-label"
                />
              </label>
              <label className="text-[10px] text-slate-500">
                Server URL (optional for Twitch / Instagram / TikTok defaults)
                <input
                  value={ephemeralServerUrl}
                  onChange={(e) => setEphemeralServerUrl(e.target.value)}
                  placeholder="rtmps://…"
                  className="mt-0.5 w-full text-[11px] bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200 font-mono"
                  data-testid="meet-broadcast-ephemeral-server-url"
                />
              </label>
              <label className="text-[10px] text-slate-500">
                Stream key
                <input
                  type="password"
                  autoComplete="off"
                  value={ephemeralStreamKey}
                  onChange={(e) => {
                    setEphemeralIgnoredNotice(null);
                    setEphemeralStreamKey(e.target.value);
                  }}
                  placeholder="Paste stream key for this session only"
                  className="mt-0.5 w-full text-[11px] bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200 font-mono"
                  data-testid="meet-broadcast-ephemeral-stream-key"
                />
              </label>
            </div>
            {ephemeralIgnoredNotice ? (
              <div
                role="alert"
                data-testid="meet-broadcast-ephemeral-ignored-idempotent"
                className="text-[11px] text-amber-200/95 border border-amber-700/55 rounded px-2 py-1.5 bg-amber-950/45 leading-snug"
              >
                {ephemeralIgnoredNotice}
              </div>
            ) : null}
              </div>
            </BroadcastCollapsibleSection>

            <BroadcastCollapsibleSection
              title="Program scene"
              subtitle="Layout, presets, and composition before you go live"
              defaultOpen={false}
              contentClassName="px-0 py-2"
            >
              <MeetBroadcastSceneControls
                destinations={bc.destinations}
                sceneConfig={sceneConfig}
                onSceneConfigChange={onSceneConfigChange}
              />
            </BroadcastCollapsibleSection>

            <BroadcastCollapsibleSection title="Analytics" subtitle="Cross-session broadcast stats" defaultOpen={false}>
              <BroadcastAnalyticsDashboard
                hostWalletAddress={hostWalletAddress}
                expandKey={dashboardExpandKey}
              />
            </BroadcastCollapsibleSection>

            <BroadcastCollapsibleSection
              title="Events & timelines"
              subtitle="Scheduled shows, templates, packages — does not auto-start"
              defaultOpen={false}
              contentClassName="px-0 py-2"
            >
              <MeetBroadcastEventsPanel
                roomId={roomId}
                hostWalletAddress={hostWalletAddress}
                launchDisabled={Boolean(live)}
                onLaunchFromEvent={(id) => void handleStartFromEvent(id)}
                onPrepareResult={(msg) => bc.setInfoMessage(msg)}
              />
            </BroadcastCollapsibleSection>

            {live && bc.session ? (
              <BroadcastCollapsibleSection
                title="Live controls"
                subtitle="Scene overrides, overlays, schedule, auto-directing, timeline"
                defaultOpen={false}
                contentClassName="px-0 py-2 space-y-3"
              >
                <MeetBroadcastLiveSceneControls
                  broadcastSessionId={bc.session.id}
                  hostWalletAddress={hostWalletAddress}
                  templateActive={Boolean(bc.session.scenePreview?.templateActive)}
                  liveScene={bc.session.scenePreview?.liveScene}
                  fetchLiveSceneState={bc.fetchLiveSceneState}
                  updateLiveSceneState={bc.updateLiveSceneState}
                  resetLiveSceneState={bc.resetLiveSceneState}
                />
                <MeetBroadcastOverlayControls
                  broadcastSessionId={bc.session.id}
                  hostWalletAddress={hostWalletAddress}
                  templateActive={Boolean(bc.session.scenePreview?.templateActive)}
                  overlaySummary={bc.session.scenePreview?.overlaySummary}
                  fetchOverlayState={bc.fetchOverlayState}
                  updateOverlayState={bc.updateOverlayState}
                  resetOverlayState={bc.resetOverlayState}
                  realtimeSyncKey={bc.broadcastRefreshSignal}
                />
                <MeetBroadcastScheduleControls
                  broadcastSessionId={bc.session.id}
                  hostWalletAddress={hostWalletAddress}
                  templateActive={Boolean(bc.session.scenePreview?.templateActive)}
                  scheduleSummary={bc.session.scenePreview?.scheduleSummary ?? null}
                  fetchScheduleState={bc.fetchScheduleState}
                  updateScheduleState={bc.updateScheduleState}
                  resetScheduleState={bc.resetScheduleState}
                  realtimeSyncKey={bc.broadcastRefreshSignal}
                />
                <MeetBroadcastAutoDirectingControls
                  broadcastSessionId={bc.session.id}
                  hostWalletAddress={hostWalletAddress}
                  templateActive={Boolean(bc.session.scenePreview?.templateActive)}
                  summaryFromStatus={bc.session.scenePreview?.autoDirectingSummary}
                  fetchAutoDirectingState={bc.fetchAutoDirectingState}
                  updateAutoDirectingState={bc.updateAutoDirectingState}
                  resetAutoDirectingState={bc.resetAutoDirectingState}
                />
                <MeetBroadcastTimelinePanel
                  broadcastSessionId={bc.session.id}
                  hostWalletAddress={hostWalletAddress}
                  onTimelineMutated={() => void bc.refreshStatus()}
                />
              </BroadcastCollapsibleSection>
            ) : null}
          </div>

          <div className="mt-3 flex flex-wrap gap-2 items-center border-t border-slate-700 pt-3">
            {!live ? (
              <button
                type="button"
                disabled={startBroadcastDisabled}
                title={startBroadcastDisabledTitle}
                onClick={() => void handleStart()}
                className="text-sm px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {actionBusy ? "Starting…" : "Start broadcast"}
              </button>
            ) : (
              <button
                type="button"
                disabled={actionBusy}
                onClick={() => void handleStop()}
                className="text-sm px-3 py-1.5 rounded bg-red-700 hover:bg-red-600 disabled:opacity-40"
              >
                {actionBusy ? "Stopping…" : "Stop broadcast"}
              </button>
            )}
            {live ? (
              <span className="text-xs text-emerald-300 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Live to {bc.sessionDestinations.length} output(s)
              </span>
            ) : null}
          </div>
          {startWarnings.length ? (
            <ul className="mt-2 text-[11px] text-amber-200/90 list-disc pl-4 space-y-0.5">
              {startWarnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          ) : null}
          <MeetBroadcastStatus
            sessionStatus={bc.session?.status ?? null}
            destinations={bc.sessionDestinations}
            layoutMode={layoutMode}
            degraded={bc.degraded}
            scenePreview={bc.session?.scenePreview ?? null}
            broadcastRealtimeConnected={bc.broadcastRealtimeConnected}
            broadcastRealtimeUsePollingFallback={bc.broadcastRealtimeUsePollingFallback}
            autoDirectingSummary={bc.session?.scenePreview?.autoDirectingSummary ?? null}
            timelinePreview={bc.timelinePreview}
            onOpenAnalyticsDashboard={() => setDashboardExpandKey((k) => k + 1)}
          />
        </div>
      ) : null}
    </div>
  );
}
