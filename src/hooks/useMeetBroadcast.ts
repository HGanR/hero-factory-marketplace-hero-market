"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { BroadcastSceneConfig } from "@/lib/meet/broadcast-scene";
import { BROADCAST_CODES } from "@/lib/meet/broadcast-codes";
import { BROADCAST_REALTIME_EVENT_TYPES } from "@/lib/meet/broadcast-realtime";
import { operatorMessagesForBroadcastStartEventAttachment } from "@/lib/meet/broadcast-start-operator-messages";

export type PublicDestination = {
  id: number;
  platform: string;
  label: string;
  serverUrl: string;
  streamKeyLast4: string;
  orientationPreference: string;
  isActive: boolean;
  requiresManualGoLive: boolean;
  lastTestedAt?: Date | string | null;
};

/** Server-truth live scene summary for active V2 template sessions (from /api/meet/broadcast/status). */
export type BroadcastLiveSceneSummary = {
  sceneType: string;
  layoutMode: string;
  updatedAt: string | null;
  updatedByUserId: number | null;
  customHeadline?: string | null;
  customSubheadline?: string | null;
};

/** V2 overlay visibility summary from status (server truth). */
export type BroadcastOverlaySummary = {
  lowerThirdVisible: boolean;
  tickerVisible: boolean;
  ctaBannerVisible: boolean;
  updatedAt: string | null;
};

/** V2 schedule summary from status /admin (server truth, polling). */
export type BroadcastAutoDirectingSummary = {
  mode: "off" | "suggest_only" | "auto_apply";
  latestRecommendedLayout: string | null;
  latestReason: string | null;
  latestConfidence: "low" | "medium" | "high" | null;
  manualOverrideActive: boolean;
  lastAppliedAt: string | null;
};

export type BroadcastScheduleSummary = {
  automationEnabled: boolean;
  countdownVisible: boolean;
  countdownTargetIso: string | null;
  nextScheduledActionAt: string | null;
  nextScheduledActionType: string | null;
  lastExecutedActionId: string | null;
  lastEvaluatedAt: string | null;
};

/** From `GET /api/meet/broadcast/status` — lightweight timeline hint (full history via `/broadcast/timeline`). */
export type BroadcastTimelinePreview = {
  eventCount: number;
  latestEvent: { summary: string; eventType: string; eventAtIso: string } | null;
};

export type BroadcastScenePreview = {
  layoutMode: string;
  portraitSafe: boolean;
  brandingEnabled: boolean;
  screenSharePriority: boolean;
  presetName: string | null;
  compositorMode?: string;
  compositorFallbackFromV2?: boolean;
  renderSessionMasked?: string | null;
  templateActive?: boolean;
  brandingRendered?: boolean;
  /** Populated when `templateActive` — operator live scene (V2 only). */
  liveScene?: BroadcastLiveSceneSummary | null;
  /** Populated when `templateActive` — operator overlays (V2 only). */
  overlaySummary?: BroadcastOverlaySummary | null;
  /** Populated when `templateActive` — schedule / countdown automation (V2 only). */
  scheduleSummary?: BroadcastScheduleSummary | null;
  scheduleUpdatedAt?: string | null;
  autoDirectingSummary?: BroadcastAutoDirectingSummary | null;
  /** Present when this session was started with a linked broadcast event. */
  broadcastEventSummary?: {
    id: number;
    title: string;
    scheduledStartIso: string;
    status: string;
    timelineTemplateName: string | null;
    launchedFromEvent: boolean;
    calendarLink?: {
      provider: string;
      syncMode: string;
      externalEventUrl: string | null;
      externalCalendarId: string | null;
      externalEventId: string | null;
      lastSyncedAt: string | null;
    } | null;
  } | null;
};

export type BroadcastSessionSummary = {
  id: number;
  roomId: string;
  livekitEgressId: string;
  status: string;
  startedAt?: Date | string | null;
  endedAt?: Date | string | null;
  layoutMode: string;
  recordingEnabled: boolean;
  scenePreview?: BroadcastScenePreview | null;
} | null;

export type SessionDestinationStatus = {
  id: number;
  /** Null when this output used one-time RTMP credentials (no saved `stream_destinations` row). */
  streamDestinationId: number | null;
  platform: string;
  label: string;
  resolvedOutputUrlMasked: string;
  status: string;
  lastError: string | null;
};

async function parseJson(res: Response) {
  const text = await res.text();
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export function useMeetBroadcast(opts: {
  roomId: string;
  layoutMode: string;
  hostWalletAddress: string;
}) {
  const [destinations, setDestinations] = useState<PublicDestination[]>([]);
  /** From GET /api/stream-destinations — false when STREAM_DESTINATION_ENCRYPTION_KEY is unset (saves will fail). */
  const [destinationsEncryptionConfigured, setDestinationsEncryptionConfigured] = useState(true);
  const [session, setSession] = useState<BroadcastSessionSummary>(null);
  const [sessionDestinations, setSessionDestinations] = useState<SessionDestinationStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [degraded, setDegraded] = useState(false);
  const [timelinePreview, setTimelinePreview] = useState<BroadcastTimelinePreview | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  /** Increments on each V2 realtime invalidation — wire into overlay/schedule editors to refetch drafts. */
  const [broadcastRefreshSignal, setBroadcastRefreshSignal] = useState(0);
  /** True when operator SSE to `/api/meet/broadcast/events` is open (V2 only). */
  const [broadcastRealtimeConnected, setBroadcastRealtimeConnected] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const seenRealtimeEventIdsRef = useRef<Set<string>>(new Set());

  const stopPoll = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const refreshStatus = useCallback(async () => {
    if (!opts.roomId) return;
    const q = new URLSearchParams({
      roomId: opts.roomId,
      ...(opts.hostWalletAddress ? { hostWallet: opts.hostWalletAddress } : {}),
    });
    const res = await fetch(`/api/meet/broadcast/status?${q.toString()}`, { credentials: "include" });
    const data = await parseJson(res);
    if (!res.ok) {
      if (res.status === 401) {
        setSession(null);
        setSessionDestinations([]);
        setDegraded(false);
        setTimelinePreview(null);
      }
      return;
    }
    setSession((data.session as BroadcastSessionSummary | null) ?? null);
    setSessionDestinations((data.destinations as SessionDestinationStatus[]) ?? []);
    setDegraded(Boolean(data.degraded));
    const tp = data.timelinePreview as BroadcastTimelinePreview | null | undefined;
    setTimelinePreview(
      tp && typeof tp.eventCount === "number"
        ? {
            eventCount: tp.eventCount,
            latestEvent: tp.latestEvent ?? null,
          }
        : null
    );
  }, [opts.roomId, opts.hostWalletAddress]);

  const loadDestinations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/stream-destinations", { credentials: "include" });
      const data = await parseJson(res);
      if (res.status === 401) {
        setErrorCode("broadcast_not_authenticated");
        setError("Sign in to manage broadcast destinations.");
        setDestinations([]);
        setDestinationsEncryptionConfigured(true);
        return;
      }
      if (!res.ok) {
        setErrorCode(String(data.code ?? "error"));
        setError(String(data.error ?? "Failed to load destinations"));
        return;
      }
      const list = (data.destinations as PublicDestination[]) ?? [];
      setDestinations(list);
      setDestinationsEncryptionConfigured(data.encryptionConfigured !== false);
      setError(null);
      setErrorCode(null);
    } catch {
      setError("Network error loading destinations");
      setErrorCode("network_error");
    } finally {
      setLoading(false);
    }
  }, []);

  const startBroadcast = useCallback(
    async (startOpts?: {
      sceneConfig?: BroadcastSceneConfig;
      scenePresetId?: number;
      /** Server loads room / preset / timeline seed from the event when not overridden in the body. */
      broadcastEventId?: number;
      /**
       * **undefined**: all active saved destinations.
       * **[]**: no saved destinations (pair with `ephemeralRtmp` for one-time-only).
       */
      savedDestinationIds?: number[];
      /** One-time RTMP for this start only — never stored; omit or leave key empty to skip. */
      ephemeralRtmp?: {
        serverUrl: string;
        streamKey: string;
        platform?: string;
        label?: string;
      };
    }) => {
      setError(null);
      setErrorCode(null);
      setInfoMessage(null);
      const body: Record<string, unknown> = {
        roomId: opts.roomId,
        layoutMode: opts.layoutMode,
        recordingEnabled: false,
        hostWallet: opts.hostWalletAddress || undefined,
      };
      if (startOpts?.broadcastEventId != null && Number.isFinite(startOpts.broadcastEventId)) {
        body.broadcastEventId = startOpts.broadcastEventId;
      }
      /** Preset id wins server-side; send only one source so DB snapshot matches the UI the host expects. */
      if (startOpts?.scenePresetId != null && Number.isFinite(startOpts.scenePresetId)) {
        body.scenePresetId = startOpts.scenePresetId;
      } else if (startOpts?.sceneConfig !== undefined) {
        body.sceneConfig = startOpts.sceneConfig;
      }
      if (startOpts?.savedDestinationIds !== undefined) {
        body.savedDestinationIds = startOpts.savedDestinationIds;
      }
      if (startOpts?.ephemeralRtmp?.streamKey?.trim()) {
        const e = startOpts.ephemeralRtmp;
        body.ephemeralRtmp = {
          serverUrl: e.serverUrl ?? "",
          streamKey: e.streamKey.trim(),
          ...(e.platform?.trim() ? { platform: e.platform.trim() } : {}),
          ...(e.label?.trim() ? { label: e.label.trim() } : {}),
        };
      }
      const res = await fetch("/api/meet/broadcast/start", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await parseJson(res);
      if (!res.ok) {
        setErrorCode(String(data.code ?? "broadcast_start_failed"));
        setError(String(data.error ?? "Start failed"));
        return {
          ok: false as const,
          warnings: [] as string[],
          sceneWarnings: [] as string[],
          idempotent: false,
          responseCode: null as string | null,
          broadcastEventAttachment: null as string | null,
          broadcastEventConflict: null as { existingEventId: number; requestedEventId: number } | null,
          ephemeralRtmpIgnored: false,
          ephemeralRtmpIgnoredReason: null as string | null,
        };
      }
      await refreshStatus();
      const w = (data.destinations as { warnings?: string[] }[] | undefined)?.flatMap((d) => d.warnings ?? []) ?? [];
      const sceneWarnings = (data.sceneWarnings as string[] | undefined) ?? [];
      const idempotent = Boolean(data.idempotent);
      const ephemeralRtmpIgnored = Boolean(data.ephemeralRtmpIgnored);
      const ephemeralRtmpIgnoredReason =
        typeof data.ephemeralRtmpIgnoredReason === "string" ? data.ephemeralRtmpIgnoredReason : null;
      const responseCode = String(data.code ?? BROADCAST_CODES.ok);
      const rawAttach = data.broadcastEventAttachment;
      const broadcastEventAttachment =
        idempotent &&
        (rawAttach === "attached" || rawAttach === "already_attached" || rawAttach === "conflict")
          ? rawAttach
          : null;
      const broadcastEventConflict =
        idempotent && data.broadcastEventConflict != null && typeof data.broadcastEventConflict === "object"
          ? (data.broadcastEventConflict as { existingEventId: number; requestedEventId: number })
          : null;

      const attachUi = operatorMessagesForBroadcastStartEventAttachment({
        broadcastEventAttachment,
        responseCode,
      });
      if (attachUi.errorMessage) {
        setInfoMessage(null);
        setError(attachUi.errorMessage);
        setErrorCode(attachUi.errorCode ?? BROADCAST_CODES.broadcastEventIdempotentConflict);
      } else if (attachUi.infoMessage) {
        setError(null);
        setErrorCode(null);
        setInfoMessage(attachUi.infoMessage);
      } else if (idempotent && ephemeralRtmpIgnored) {
        setError(null);
        setErrorCode(null);
        setInfoMessage(null);
      } else if (idempotent) {
        setError(null);
        setErrorCode(null);
        setInfoMessage("Broadcast already active for you in this room — no duplicate egress started.");
      } else {
        setError(null);
        setErrorCode(null);
        setInfoMessage(null);
      }

      return {
        ok: true as const,
        warnings: w,
        sceneWarnings,
        idempotent,
        responseCode,
        broadcastEventAttachment,
        broadcastEventConflict,
        ephemeralRtmpIgnored,
        ephemeralRtmpIgnoredReason,
      };
    },
    [opts.roomId, opts.layoutMode, opts.hostWalletAddress, refreshStatus]
  );

  const stopBroadcast = useCallback(async () => {
    setError(null);
    setErrorCode(null);
    setInfoMessage(null);
    const res = await fetch("/api/meet/broadcast/stop", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        roomId: opts.roomId,
        hostWallet: opts.hostWalletAddress || undefined,
      }),
    });
    const data = await parseJson(res);
    if (!res.ok) {
      setErrorCode(String(data.code ?? "broadcast_stop_failed"));
      setError(String(data.error ?? "Stop failed"));
      return false;
    }
    await refreshStatus();
    if (data.code === "broadcast_stop_noop") {
      setInfoMessage(String(data.message ?? "No active broadcast for this room — nothing to stop."));
    }
    return true;
  }, [opts.roomId, opts.hostWalletAddress, refreshStatus]);

  const testDestination = useCallback(async (id: number) => {
    const res = await fetch(`/api/meet/broadcast/destinations/${id}/test`, {
      method: "POST",
      credentials: "include",
    });
    const data = await parseJson(res);
    if (!res.ok) {
      setErrorCode(String(data.code ?? "broadcast_test_failed"));
      setError(String(data.error ?? "Test failed"));
      return null;
    }
    await loadDestinations();
    return data as { warnings?: string[]; maskedUrl?: string | null; validUrl?: boolean };
  }, [loadDestinations]);

  useEffect(() => {
    void loadDestinations();
    void refreshStatus();
  }, [loadDestinations, refreshStatus]);

  useEffect(() => {
    const live =
      session &&
      (session.status === "starting" || session.status === "active");
    if (live) {
      if (!pollRef.current) {
        /**
         * Status poll carries `scenePreview.liveScene` and `overlaySummary` for V2; template polls render-session ~3s.
         * Combined delay is a lower bound on operator→egress visibility (eventually consistent, not frame-perfect).
         */
        pollRef.current = setInterval(() => {
          void refreshStatus();
        }, 4000);
      }
    } else {
      stopPoll();
    }
    return () => stopPoll();
  }, [session, refreshStatus, stopPoll]);

  /**
   * Opens an operator SSE connection for a session. Events are invalidation hints only — refetch status (and related APIs) after receipt.
   * The hook also auto-subscribes while an active V2 template session is live; use this for tests or custom wiring (avoid duplicate opens).
   */
  const subscribeToBroadcastEvents = useCallback(
    (broadcastSessionId: number) => {
      seenRealtimeEventIdsRef.current.clear();
      const q = new URLSearchParams({
        broadcastSessionId: String(broadcastSessionId),
        ...(opts.hostWalletAddress ? { hostWallet: opts.hostWalletAddress } : {}),
      });
      const es = new EventSource(`/api/meet/broadcast/events?${q.toString()}`, { withCredentials: true });
      es.onopen = () => setBroadcastRealtimeConnected(true);
      es.onerror = () => setBroadcastRealtimeConnected(false);
      const trimSeenIds = () => {
        const s = seenRealtimeEventIdsRef.current;
        if (s.size > 220) {
          seenRealtimeEventIdsRef.current = new Set([...s].slice(110));
        }
      };
      const onHint = (ev: MessageEvent) => {
        try {
          const d = JSON.parse(String(ev.data)) as { eventId?: string };
          if (typeof d.eventId === "string" && d.eventId.trim()) {
            const id = d.eventId.trim();
            if (seenRealtimeEventIdsRef.current.has(id)) return;
            seenRealtimeEventIdsRef.current.add(id);
            trimSeenIds();
          }
        } catch {
          /* ignore */
        }
        void refreshStatus().then(() => setBroadcastRefreshSignal((n) => n + 1));
      };
      for (const t of BROADCAST_REALTIME_EVENT_TYPES) {
        es.addEventListener(t, onHint);
      }
      return () => {
        es.close();
        setBroadcastRealtimeConnected(false);
      };
    },
    [opts.hostWalletAddress, refreshStatus]
  );

  const unsubscribeFromBroadcastEvents = useCallback((unsubscribe: () => void) => {
    unsubscribe();
  }, []);

  useEffect(() => {
    const live =
      session &&
      (session.status === "starting" || session.status === "active") &&
      Boolean(session.scenePreview?.templateActive);
    if (!live || !session) {
      setBroadcastRealtimeConnected(false);
      return;
    }
    const close = subscribeToBroadcastEvents(session.id);
    return () => {
      close();
      setBroadcastRealtimeConnected(false);
    };
  }, [
    session?.id,
    session?.status,
    session?.scenePreview?.templateActive,
    subscribeToBroadcastEvents,
  ]);

  const fetchLiveSceneState = useCallback(
    async (broadcastSessionId: number) => {
      const q = new URLSearchParams({
        broadcastSessionId: String(broadcastSessionId),
        ...(opts.hostWalletAddress ? { hostWallet: opts.hostWalletAddress } : {}),
      });
      const res = await fetch(`/api/meet/broadcast/live-scene?${q.toString()}`, { credentials: "include" });
      const data = await parseJson(res);
      if (!res.ok) {
        return { ok: false as const, error: String(data.error ?? "Failed"), code: String(data.code ?? "") };
      }
      return { ok: true as const, state: data.state };
    },
    [opts.hostWalletAddress]
  );

  const updateLiveSceneState = useCallback(
    async (broadcastSessionId: number, patch: Record<string, unknown>) => {
      const res = await fetch("/api/meet/broadcast/live-scene", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          broadcastSessionId,
          hostWallet: opts.hostWalletAddress || undefined,
          ...patch,
        }),
      });
      const data = await parseJson(res);
      if (!res.ok) {
        return { ok: false as const, error: String(data.error ?? "Failed"), code: String(data.code ?? "") };
      }
      await refreshStatus();
      return { ok: true as const };
    },
    [opts.hostWalletAddress, refreshStatus]
  );

  const resetLiveSceneState = useCallback(
    async (broadcastSessionId: number) => {
      const res = await fetch("/api/meet/broadcast/live-scene/reset", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          broadcastSessionId,
          hostWallet: opts.hostWalletAddress || undefined,
        }),
      });
      const data = await parseJson(res);
      if (!res.ok) {
        return { ok: false as const, error: String(data.error ?? "Failed"), code: String(data.code ?? "") };
      }
      await refreshStatus();
      return { ok: true as const };
    },
    [opts.hostWalletAddress, refreshStatus]
  );

  const fetchOverlayState = useCallback(
    async (broadcastSessionId: number) => {
      const q = new URLSearchParams({
        broadcastSessionId: String(broadcastSessionId),
        ...(opts.hostWalletAddress ? { hostWallet: opts.hostWalletAddress } : {}),
      });
      const res = await fetch(`/api/meet/broadcast/overlays?${q.toString()}`, { credentials: "include" });
      const data = await parseJson(res);
      if (!res.ok) {
        return { ok: false as const, error: String(data.error ?? "Failed"), code: String(data.code ?? "") };
      }
      return { ok: true as const, state: data.state };
    },
    [opts.hostWalletAddress]
  );

  const updateOverlayState = useCallback(
    async (broadcastSessionId: number, patch: Record<string, unknown>) => {
      const res = await fetch("/api/meet/broadcast/overlays", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          broadcastSessionId,
          hostWallet: opts.hostWalletAddress || undefined,
          ...patch,
        }),
      });
      const data = await parseJson(res);
      if (!res.ok) {
        return { ok: false as const, error: String(data.error ?? "Failed"), code: String(data.code ?? "") };
      }
      await refreshStatus();
      return { ok: true as const };
    },
    [opts.hostWalletAddress, refreshStatus]
  );

  const resetOverlayState = useCallback(
    async (broadcastSessionId: number) => {
      const res = await fetch("/api/meet/broadcast/overlays/reset", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          broadcastSessionId,
          hostWallet: opts.hostWalletAddress || undefined,
        }),
      });
      const data = await parseJson(res);
      if (!res.ok) {
        return { ok: false as const, error: String(data.error ?? "Failed"), code: String(data.code ?? "") };
      }
      await refreshStatus();
      return { ok: true as const };
    },
    [opts.hostWalletAddress, refreshStatus]
  );

  const fetchScheduleState = useCallback(
    async (broadcastSessionId: number) => {
      const q = new URLSearchParams({
        broadcastSessionId: String(broadcastSessionId),
        ...(opts.hostWalletAddress ? { hostWallet: opts.hostWalletAddress } : {}),
      });
      const res = await fetch(`/api/meet/broadcast/schedule?${q.toString()}`, { credentials: "include" });
      const data = await parseJson(res);
      if (!res.ok) {
        return { ok: false as const, error: String(data.error ?? "Failed"), code: String(data.code ?? "") };
      }
      return {
        ok: true as const,
        state: data.state as Record<string, unknown>,
        summary: data.summary as BroadcastScheduleSummary | undefined,
        persisted: Boolean(data.persisted),
      };
    },
    [opts.hostWalletAddress]
  );

  const updateScheduleState = useCallback(
    async (broadcastSessionId: number, patch: Record<string, unknown>) => {
      const res = await fetch("/api/meet/broadcast/schedule", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          broadcastSessionId,
          hostWallet: opts.hostWalletAddress || undefined,
          ...patch,
        }),
      });
      const data = await parseJson(res);
      if (!res.ok) {
        return { ok: false as const, error: String(data.error ?? "Failed"), code: String(data.code ?? "") };
      }
      await refreshStatus();
      return {
        ok: true as const,
        state: data.state as Record<string, unknown>,
        summary: data.summary as BroadcastScheduleSummary | undefined,
      };
    },
    [opts.hostWalletAddress, refreshStatus]
  );

  const fetchAutoDirectingState = useCallback(
    async (broadcastSessionId: number) => {
      const q = new URLSearchParams({
        broadcastSessionId: String(broadcastSessionId),
        ...(opts.hostWalletAddress ? { hostWallet: opts.hostWalletAddress } : {}),
      });
      const res = await fetch(`/api/meet/broadcast/auto-directing?${q.toString()}`, { credentials: "include" });
      const data = await parseJson(res);
      if (!res.ok) {
        return { ok: false as const, error: String(data.error ?? "Failed"), code: String(data.code ?? "") };
      }
      return { ok: true as const, data };
    },
    [opts.hostWalletAddress]
  );

  const updateAutoDirectingState = useCallback(
    async (
      broadcastSessionId: number,
      body: Record<string, unknown>
    ) => {
      const res = await fetch("/api/meet/broadcast/auto-directing", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          broadcastSessionId,
          hostWallet: opts.hostWalletAddress || undefined,
          ...body,
        }),
      });
      const data = await parseJson(res);
      if (!res.ok) {
        return { ok: false as const, error: String(data.error ?? "Failed"), code: String(data.code ?? "") };
      }
      await refreshStatus();
      return { ok: true as const, data };
    },
    [opts.hostWalletAddress, refreshStatus]
  );

  const resetAutoDirectingState = useCallback(
    async (broadcastSessionId: number) => {
      const res = await fetch("/api/meet/broadcast/auto-directing/reset", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          broadcastSessionId,
          hostWallet: opts.hostWalletAddress || undefined,
        }),
      });
      const data = await parseJson(res);
      if (!res.ok) {
        return { ok: false as const, error: String(data.error ?? "Failed"), code: String(data.code ?? "") };
      }
      await refreshStatus();
      return { ok: true as const, data };
    },
    [opts.hostWalletAddress, refreshStatus]
  );

  const resetScheduleState = useCallback(
    async (broadcastSessionId: number) => {
      const res = await fetch("/api/meet/broadcast/schedule/reset", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          broadcastSessionId,
          hostWallet: opts.hostWalletAddress || undefined,
        }),
      });
      const data = await parseJson(res);
      if (!res.ok) {
        return { ok: false as const, error: String(data.error ?? "Failed"), code: String(data.code ?? "") };
      }
      await refreshStatus();
      return {
        ok: true as const,
        state: data.state as Record<string, unknown>,
        summary: data.summary as BroadcastScheduleSummary | undefined,
      };
    },
    [opts.hostWalletAddress, refreshStatus]
  );

  return {
    destinations,
    destinationsEncryptionConfigured,
    session,
    sessionDestinations,
    loading,
    error,
    errorCode,
    setError,
    setErrorCode,
    degraded,
    timelinePreview,
    infoMessage,
    setInfoMessage,
    loadDestinations,
    refreshStatus,
    startBroadcast,
    stopBroadcast,
    testDestination,
    fetchLiveSceneState,
    updateLiveSceneState,
    resetLiveSceneState,
    fetchOverlayState,
    updateOverlayState,
    resetOverlayState,
    fetchScheduleState,
    updateScheduleState,
    resetScheduleState,
    fetchAutoDirectingState,
    updateAutoDirectingState,
    resetAutoDirectingState,
    broadcastRealtimeConnected,
    /** When V2 template is active but SSE is not connected, UI should note polling fallback. */
    broadcastRealtimeUsePollingFallback:
      Boolean(
        session &&
          (session.status === "starting" || session.status === "active") &&
          session.scenePreview?.templateActive
      ) && !broadcastRealtimeConnected,
    broadcastRefreshSignal,
    subscribeToBroadcastEvents,
    unsubscribeFromBroadcastEvents,
  };
}
