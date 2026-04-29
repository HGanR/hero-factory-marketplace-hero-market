import { and, desc, eq, inArray, ne } from "drizzle-orm";
import { getDb } from "@/lib/db";
import {
  meetBroadcastEvents,
  meetBroadcastSessionDestinations,
  meetBroadcastSessions,
  streamDestinations,
} from "@/lib/db/schema";
import {
  decryptStreamKey,
  isStreamDestinationEncryptionConfigured,
  streamKeyLast4,
} from "@/lib/streaming/crypto";
import type { StreamPlatform } from "@/lib/streaming/destinations";
import { normalizeStreamPlatform } from "@/lib/streaming/destinations";
import {
  isValidRtmpIngestUrl,
  maskRtmpOutputUrl,
  resolveRtmpDestination,
} from "@/lib/streaming/rtmp";
import {
  fetchRoomEgressStatusById,
  livekitHttpHostFromEnv,
  startRoomCompositeRtmpFanOut,
  stopEgressById,
} from "@/lib/streaming/livekit-egress";
import { broadcastAudit } from "./broadcast-audit";
import { BROADCAST_CODES } from "./broadcast-codes";
import { BROADCAST_LIVE_STATUSES, BROADCAST_STUCK_STARTING_MS } from "./broadcast-constants";
import { reconcileBroadcastSessionDecision } from "./broadcast-reconcile";
import {
  incrementBroadcastCompositorV2Attempt,
  incrementBroadcastCompositorV2Failure,
  incrementBroadcastCompositorV2Fallback,
  incrementBroadcastCompositorV2Success,
  incrementBroadcastDegraded,
  incrementBroadcastEgressFailure,
  incrementBroadcastPreflightFailure,
  incrementBroadcastReconciled,
  incrementBroadcastRoomBusy,
  incrementBroadcastStartIdempotent,
  incrementBroadcastEventIdempotentAttach,
  incrementBroadcastEventIdempotentAttachConflict,
  incrementBroadcastEventLaunch,
  incrementBroadcastStartSuccess,
  incrementBroadcastStop,
  incrementBroadcastStopNoop,
} from "./broadcast-metrics";
import { getProviderCapabilities, providerCapabilitiesSnapshot } from "@/lib/streaming/provider-capabilities";
import {
  brandingEnabled,
  parseStoredSceneSnapshot,
  type BroadcastSceneConfig,
  type BroadcastSceneSnapshot,
} from "./broadcast-scene";
import { buildBroadcastCompositorRenderModel, shouldUseRenderedCompositor } from "./broadcast-compositor";
import { prepareV2RenderedCompositorOrReason } from "./broadcast-compositor-fallback";
import {
  isRenderedBroadcastCompositorEnabledForUser,
  isRenderedBroadcastCompositorEnabledGlobally,
} from "./broadcast-feature-flags";
import { buildBroadcastProgramState } from "./broadcast-program";
import { getDefaultLiveSceneStateFromSession, isV2LiveSceneControlAvailable } from "./broadcast-live-scenes";
import { getBroadcastLiveSceneState } from "./broadcast-live-scene-store";
import { getDefaultOverlayState } from "./broadcast-overlays";
import { getBroadcastOverlayState } from "./broadcast-overlay-store";
import { buildScheduleSummaryForStatus } from "./broadcast-schedule";
import { evaluateBroadcastScheduleForActiveSession } from "./broadcast-scheduler";
import { evaluateBroadcastAutoDirectingForActiveSession, type SessionRow } from "./broadcast-auto-directing-engine";
import {
  buildAutoDirectingPublicSummary,
  getBroadcastAutoDirectingState,
} from "./broadcast-auto-directing-store";
import { publishScheduleUpdated } from "./broadcast-event-publisher";
import { getBroadcastEventById } from "./broadcast-event-store";
import { upsertBroadcastScheduleState } from "./broadcast-schedule-store";
import {
  buildScheduleStateFromTimelineTemplate,
  type BroadcastTimelineTemplateBody,
} from "./broadcast-timeline-template";
import { getTimelineTemplateById } from "./broadcast-timeline-templates";
import { toBroadcastCalendarLinkSummary } from "./broadcast-calendar-sync";
import { getBroadcastCalendarLinkByBroadcastEventId } from "./broadcast-calendar-link-store";
import { publishBroadcastTimelineEventSafe } from "./broadcast-timeline-publisher";
import { getBroadcastTimelinePreviewForSession } from "./broadcast-timeline-store";

export { BROADCAST_LIVE_STATUSES } from "./broadcast-constants";

export interface PreparedDestinationRow {
  /** Null for one-time RTMP rows (no persisted `stream_destinations` record). */
  streamDestinationId: number | null;
  platform: string;
  label: string;
  finalOutputUrl: string;
  maskedUrl: string;
  warnings: string[];
}

function totalPreparedWarningCount(prepared: PreparedDestinationRow[]): number {
  return prepared.reduce((n, p) => n + p.warnings.length, 0);
}

function broadcastErr(message: string, code: string): Error {
  const e = new Error(message);
  (e as Error & { code: string }).code = code;
  return e;
}

function sceneConfigFromSnapshot(s: BroadcastSceneSnapshot): BroadcastSceneConfig {
  return {
    layoutMode: s.layoutMode,
    branding: s.branding,
    showParticipantNames: s.showParticipantNames,
    showMutedIndicators: s.showMutedIndicators,
    showFooter: s.showFooter,
    portraitSafe: s.portraitSafe,
    screenSharePriority: s.screenSharePriority,
  };
}

export type IdempotentBroadcastEventAttachmentOutcome =
  | { kind: "skipped" }
  | { kind: "attached"; eventId: number }
  | { kind: "already_attached"; eventId: number }
  | { kind: "conflict"; requestedEventId: number; existingEventId: number };

/**
 * Idempotent start: optionally link `broadcast_event_id` on the existing live session row.
 *
 * Caller must pass a session already selected as the operator's live row (`starting` | `active`) for `userId` + `roomId`.
 *
 * - No `broadcastEventId` in the start request → **skipped** (no DB writes).
 * - Session `userId` / `roomId` (trimmed) must match args → otherwise **skipped** (defensive).
 * - Session `status` must be in {@link BROADCAST_LIVE_STATUSES} → otherwise **skipped** (do not attach to ended/failed rows).
 * - Event must exist for this user and not be `cancelled` | `completed` → otherwise **skipped** (defensive; route should pre-validate).
 * - Session has no `broadcastEventId` → **attach** (update session + set event `live`), audit + metric.
 * - Session already has the same `broadcastEventId` → **already_attached**, audit + metric, no DB change.
 * - Session has a different `broadcastEventId` → **conflict**, no mutation, audit + metric.
 */
export async function reconcileIdempotentSessionBroadcastEvent(
  db: Awaited<ReturnType<typeof getDb>>,
  args: {
    session: typeof meetBroadcastSessions.$inferSelect;
    broadcastEventId: number | null | undefined;
    userId: number;
    roomId: string;
  }
): Promise<IdempotentBroadcastEventAttachmentOutcome> {
  const requestEventId =
    args.broadcastEventId != null && Number.isFinite(args.broadcastEventId)
      ? Math.floor(args.broadcastEventId)
      : null;
  if (requestEventId == null) return { kind: "skipped" };

  const room = args.roomId.trim();
  if (args.session.roomId !== room || args.session.userId !== args.userId) {
    return { kind: "skipped" };
  }

  if (
    !BROADCAST_LIVE_STATUSES.includes(args.session.status as (typeof BROADCAST_LIVE_STATUSES)[number])
  ) {
    return { kind: "skipped" };
  }

  const ev = await getBroadcastEventById(requestEventId, args.userId);
  if (!ev || ev.status === "cancelled" || ev.status === "completed") {
    return { kind: "skipped" };
  }

  const existingRaw = args.session.broadcastEventId;
  const existing =
    existingRaw != null && Number.isFinite(Number(existingRaw)) ? Math.floor(Number(existingRaw)) : null;

  if (existing == null) {
    await db
      .update(meetBroadcastSessions)
      .set({ broadcastEventId: requestEventId, updatedAt: new Date() })
      .where(eq(meetBroadcastSessions.id, args.session.id));

    await db
      .update(meetBroadcastEvents)
      .set({ status: "live", updatedAt: new Date() })
      .where(and(eq(meetBroadcastEvents.id, requestEventId), eq(meetBroadcastEvents.userId, args.userId)));

    broadcastAudit("broadcast_event_idempotent_attached", {
      sessionId: args.session.id,
      roomId: room,
      userId: args.userId,
      eventId: requestEventId,
    });
    incrementBroadcastEventIdempotentAttach({
      userId: args.userId,
      roomId: room,
      sessionId: args.session.id,
      reason: "attached",
    });
    publishBroadcastTimelineEventSafe({
      broadcastSessionId: args.session.id,
      userId: args.userId,
      eventType: "event_attached",
      summary: `Broadcast event ${requestEventId} linked`,
      detailsJson: { broadcastEventId: requestEventId, kind: "attached" },
    });
    return { kind: "attached", eventId: requestEventId };
  }

  if (existing === requestEventId) {
    broadcastAudit("broadcast_event_idempotent_already_attached", {
      sessionId: args.session.id,
      roomId: room,
      userId: args.userId,
      eventId: requestEventId,
    });
    incrementBroadcastEventIdempotentAttach({
      userId: args.userId,
      roomId: room,
      sessionId: args.session.id,
      reason: "already_attached",
    });
    publishBroadcastTimelineEventSafe({
      broadcastSessionId: args.session.id,
      userId: args.userId,
      eventType: "event_attached",
      summary: `Event ${requestEventId} already linked`,
      detailsJson: { broadcastEventId: requestEventId, kind: "already_attached" },
    });
    return { kind: "already_attached", eventId: requestEventId };
  }

  broadcastAudit("broadcast_event_idempotent_conflict", {
    sessionId: args.session.id,
    roomId: room,
    userId: args.userId,
    requestedEventId: requestEventId,
    existingEventId: existing,
  });
  incrementBroadcastEventIdempotentAttachConflict({
    userId: args.userId,
    roomId: room,
    sessionId: args.session.id,
    reason: `requested_${requestEventId}_existing_${existing}`,
  });
  publishBroadcastTimelineEventSafe({
    broadcastSessionId: args.session.id,
    userId: args.userId,
    eventType: "event_conflict",
    summary: "Broadcast event id mismatch on idempotent attach",
    detailsJson: { requestedEventId: requestEventId, existingEventId: existing },
  });
  return { kind: "conflict", requestedEventId: requestEventId, existingEventId: existing };
}

async function markSessionEndedReconciled(
  db: Awaited<ReturnType<typeof getDb>>,
  sessionId: number,
  reason: string,
  audit: { roomId: string; userId: number }
) {
  await db
    .update(meetBroadcastSessions)
    .set({
      status: "ended",
      endedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(meetBroadcastSessions.id, sessionId));

  await db
    .update(meetBroadcastSessionDestinations)
    .set({
      status: "ended",
      lastError: reason,
      endedAt: new Date(),
    })
    .where(eq(meetBroadcastSessionDestinations.broadcastSessionId, sessionId));

  broadcastAudit("broadcast_session_reconciled", {
    sessionId,
    roomId: audit.roomId,
    userId: audit.userId,
    reasonSummary: reason.slice(0, 200),
  });
  incrementBroadcastReconciled({
    userId: audit.userId,
    roomId: audit.roomId,
    sessionId,
  });
  publishBroadcastTimelineEventSafe({
    broadcastSessionId: sessionId,
    userId: audit.userId,
    eventType: "session_stopped",
    summary: "Session ended (reconcile)",
    detailsJson: { reason: "reconcile", reasonSummary: reason.slice(0, 200) },
  });
}

async function reconcileRoomBroadcastSessionsWithLiveKit(
  db: Awaited<ReturnType<typeof getDb>>,
  roomId: string
) {
  if (!livekitHttpHostFromEnv()) return;

  const anyLive = await db
    .select({ id: meetBroadcastSessions.id })
    .from(meetBroadcastSessions)
    .where(
      and(
        eq(meetBroadcastSessions.roomId, roomId),
        inArray(meetBroadcastSessions.status, [...BROADCAST_LIVE_STATUSES])
      )
    )
    .limit(1);

  if (!anyLive[0]) return;

  const nowMs = Date.now();
  let byId: Map<string, number>;
  try {
    byId = await fetchRoomEgressStatusById(roomId);
  } catch (e) {
    broadcastAudit("broadcast_reconcile_skipped", {
      roomId,
      errorSummary: (e instanceof Error ? e.message : "unknown").slice(0, 200),
    });
    return;
  }

  const liveRows = await db
    .select()
    .from(meetBroadcastSessions)
    .where(
      and(
        eq(meetBroadcastSessions.roomId, roomId),
        inArray(meetBroadcastSessions.status, [...BROADCAST_LIVE_STATUSES])
      )
    );

  for (const s of liveRows) {
    const eid = (s.livekitEgressId ?? "").trim();
    if (!eid) continue;

    const anchor = s.startedAt ?? s.updatedAt ?? s.createdAt;
    const sessionAgeMs = nowMs - new Date(anchor).getTime();

    const decision = reconcileBroadcastSessionDecision({
      livekitEgressId: eid,
      liveKitStatus: byId.get(eid),
      sessionAgeMs,
    });
    if (!decision) continue;

    await markSessionEndedReconciled(db, s.id, decision.reason, {
      roomId,
      userId: s.userId,
    });
  }
}

async function markSessionTerminalFailed(db: Awaited<ReturnType<typeof getDb>>, sessionId: number, message: string) {
  const owner = await db
    .select({ userId: meetBroadcastSessions.userId })
    .from(meetBroadcastSessions)
    .where(eq(meetBroadcastSessions.id, sessionId))
    .limit(1);
  const ownerUserId = owner[0]?.userId;

  await db
    .update(meetBroadcastSessions)
    .set({
      status: "failed",
      updatedAt: new Date(),
      endedAt: new Date(),
    })
    .where(eq(meetBroadcastSessions.id, sessionId));

  await db
    .update(meetBroadcastSessionDestinations)
    .set({
      status: "failed",
      lastError: message,
      endedAt: new Date(),
    })
    .where(eq(meetBroadcastSessionDestinations.broadcastSessionId, sessionId));

  if (ownerUserId != null) {
    publishBroadcastTimelineEventSafe({
      broadcastSessionId: sessionId,
      userId: ownerUserId,
      eventType: "session_stopped",
      summary: "Session failed",
      detailsJson: { reason: "terminal_failed", errorSummary: message.slice(0, 200) },
    });
  }
}

async function recoverStuckStartingSessions(
  db: Awaited<ReturnType<typeof getDb>>,
  roomId: string,
  userId: number
) {
  const rows = await db
    .select()
    .from(meetBroadcastSessions)
    .where(
      and(
        eq(meetBroadcastSessions.roomId, roomId),
        eq(meetBroadcastSessions.userId, userId),
        eq(meetBroadcastSessions.status, "starting")
      )
    );

  const now = Date.now();
  for (const s of rows) {
    const egressEmpty = !(s.livekitEgressId ?? "").trim();
    if (!egressEmpty) continue;
    const age = now - new Date(s.createdAt).getTime();
    if (age > BROADCAST_STUCK_STARTING_MS) {
      await markSessionTerminalFailed(db, s.id, "stuck_starting_timeout");
      broadcastAudit(BROADCAST_CODES.stuckSessionRecovered, {
        sessionId: s.id,
        roomId,
        userId,
        reason: "starting_timeout_ms",
        ageMs: age,
        thresholdMs: BROADCAST_STUCK_STARTING_MS,
      });
    }
  }
}

function sessionRowsToPrepared(
  rows: (typeof meetBroadcastSessionDestinations.$inferSelect)[]
): PreparedDestinationRow[] {
  return rows.map((r) => ({
    streamDestinationId: r.streamDestinationId ?? null,
    platform: r.platform,
    label: r.label,
    finalOutputUrl: "",
    maskedUrl: r.resolvedOutputUrlMasked,
    warnings: [] as string[],
  }));
}

export function prepareDestinationsForEgress(
  rows: typeof streamDestinations.$inferSelect[],
  layoutMode: string
): { prepared: PreparedDestinationRow[]; errors: string[] } {
  const errors: string[] = [];
  const prepared: PreparedDestinationRow[] = [];

  for (const row of rows) {
    const platform = normalizeStreamPlatform(row.platform);
    if (!platform) {
      errors.push(`Unknown platform on destination ${row.id}`);
      continue;
    }
    let key: string;
    try {
      key = decryptStreamKey(row.streamKeyEncrypted);
    } catch {
      errors.push(`Decrypt failed for destination ${row.id}`);
      continue;
    }
    const resolved = resolveRtmpDestination({
      platform,
      serverUrl: row.serverUrl,
      streamKey: key,
      meetingLayout: layoutMode,
      orientationPreference: row.orientationPreference,
    });
    if (!resolved.finalOutputUrl) {
      errors.push(`Could not build RTMP URL for destination ${row.id} (${row.platform})`);
      continue;
    }
    if (!isValidRtmpIngestUrl(resolved.finalOutputUrl)) {
      errors.push(`Invalid RTMP ingest URL shape for destination ${row.id}`);
      continue;
    }
    prepared.push({
      streamDestinationId: row.id,
      platform: row.platform,
      label: row.label,
      finalOutputUrl: resolved.finalOutputUrl,
      maskedUrl: maskRtmpOutputUrl(resolved.finalOutputUrl, row.streamKeyLast4),
      warnings: resolved.warnings,
    });
  }

  return { prepared, errors };
}

/** Build a single prepared row from pasted RTMP credentials (not read from DB). */
export function prepareEphemeralRtmpForEgress(
  input: {
    serverUrl: string;
    streamKey: string;
    platform?: string;
    label?: string;
    orientationPreference?: string;
  },
  layoutMode: string
): { prepared: PreparedDestinationRow | null; error: string | null } {
  const streamKey = (input.streamKey ?? "").trim();
  if (!streamKey) {
    return { prepared: null, error: "Stream key is required for one-time RTMP." };
  }
  const platRaw = (input.platform ?? "custom").trim();
  let platform: StreamPlatform = normalizeStreamPlatform(platRaw) ?? "custom";
  const resolved = resolveRtmpDestination({
    platform,
    serverUrl: input.serverUrl ?? "",
    streamKey,
    meetingLayout: layoutMode,
    orientationPreference: (input.orientationPreference ?? "auto").trim().toLowerCase() || "auto",
  });
  if (!resolved.finalOutputUrl) {
    return {
      prepared: null,
      error: "Could not build RTMP URL for one-time destination — check server URL and platform.",
    };
  }
  if (!isValidRtmpIngestUrl(resolved.finalOutputUrl)) {
    return { prepared: null, error: "Invalid RTMP ingest URL shape for one-time destination." };
  }
  const label = (input.label ?? "").trim().slice(0, 120);
  return {
    prepared: {
      streamDestinationId: null,
      platform,
      label: label || "One-time RTMP",
      finalOutputUrl: resolved.finalOutputUrl,
      maskedUrl: maskRtmpOutputUrl(resolved.finalOutputUrl, streamKeyLast4(streamKey)),
      warnings: resolved.warnings,
    },
    error: null,
  };
}

export async function startMeetBroadcastSession(params: {
  userId: number;
  roomId: string;
  /** LiveKit room composite layout string (grid | speaker | single-speaker). */
  liveKitLayout: string;
  /** Passed into RTMP preflight / orientation hints (usually matches liveKitLayout in V1). */
  rtmpMeetingLayout: string;
  recordingEnabled: boolean;
  sceneSnapshot: BroadcastSceneSnapshot;
  /** Optional calendar event link; persisted on session when start succeeds. */
  broadcastEventId?: number | null;
  /** When V2 succeeds, seed schedule from timeline template (offsets from event start). */
  scheduleSeedFromTimeline?: {
    eventStartIso: string;
    template: BroadcastTimelineTemplateBody;
  } | null;
  /**
   * When **undefined** (default): include all active saved destinations for this user.
   * When **[]**: include no saved destinations (one-time-only or invalid if no ephemeral).
   * When **non-empty**: only those destination ids (must be active and owned).
   */
  savedDestinationIds?: number[];
  /** One-time credentials for this launch only — never persisted to `stream_destinations`. */
  ephemeralRtmp?: {
    serverUrl: string;
    streamKey: string;
    platform?: string;
    label?: string;
    orientationPreference?: string;
  } | null;
}): Promise<{
  sessionId: number;
  egressId: string;
  destinations: PreparedDestinationRow[];
  idempotent?: boolean;
  sceneSnapshot?: BroadcastSceneSnapshot;
  /** Set only on idempotent path when `broadcastEventId` was supplied. */
  broadcastEventAttachment?: "attached" | "already_attached" | "conflict";
  broadcastEventConflict?: { existingEventId: number; requestedEventId: number };
}> {
  const db = await getDb();
  const roomId = params.roomId.trim();
  if (!roomId) throw broadcastErr("roomId required", "validation_error");

  await recoverStuckStartingSessions(db, roomId, params.userId);
  await reconcileRoomBroadcastSessionsWithLiveKit(db, roomId);

  const mineLive = await db
    .select()
    .from(meetBroadcastSessions)
    .where(
      and(
        eq(meetBroadcastSessions.roomId, roomId),
        eq(meetBroadcastSessions.userId, params.userId),
        inArray(meetBroadcastSessions.status, [...BROADCAST_LIVE_STATUSES])
      )
    )
    .orderBy(desc(meetBroadcastSessions.createdAt))
    .limit(1);

  if (mineLive[0]) {
    const s = mineLive[0];
    const destRows = await db
      .select()
      .from(meetBroadcastSessionDestinations)
      .where(eq(meetBroadcastSessionDestinations.broadcastSessionId, s.id));
    const idemPlatforms = destRows.map((d) => d.platform);
    const idemScene = parseStoredSceneSnapshot(s.sceneConfigJson, s.layoutMode);
    broadcastAudit("broadcast_start_idempotent", {
      sessionId: s.id,
      roomId,
      userId: params.userId,
      egressId: (s.livekitEgressId ?? "").slice(0, 64) || null,
      destinationCount: destRows.length,
      providerCapabilitiesSnapshot: providerCapabilitiesSnapshot(idemPlatforms),
      warningCount: 0,
      degradedAtStart: destRows.some((d) => d.status === "failed"),
      sceneLayoutMode: idemScene.layoutMode,
      portraitSafe: idemScene.portraitSafe,
      screenSharePriority: idemScene.screenSharePriority,
      brandingEnabled: brandingEnabled(idemScene),
      compositorMode: s.compositorMode ?? "v1_livekit_default",
      compositorFallbackFromV2: Boolean(s.compositorFallbackFromV2),
      renderSessionRef: s.renderSessionId != null ? `rs_${s.renderSessionId}` : null,
      templatePathUsed: Boolean(s.renderSessionId),
    });
    incrementBroadcastStartIdempotent({
      userId: params.userId,
      roomId,
      sessionId: s.id,
    });
    publishBroadcastTimelineEventSafe({
      broadcastSessionId: s.id,
      userId: params.userId,
      eventType: "note",
      summary: "Idempotent start — session already live",
      detailsJson: { idempotent: true, destinationCount: destRows.length },
    });

    const attachOutcome = await reconcileIdempotentSessionBroadcastEvent(db, {
      session: s,
      broadcastEventId: params.broadcastEventId,
      userId: params.userId,
      roomId,
    });

    let broadcastEventAttachment: "attached" | "already_attached" | "conflict" | undefined;
    let broadcastEventConflict: { existingEventId: number; requestedEventId: number } | undefined;
    if (attachOutcome.kind === "attached") {
      broadcastEventAttachment = "attached";
    } else if (attachOutcome.kind === "already_attached") {
      broadcastEventAttachment = "already_attached";
    } else if (attachOutcome.kind === "conflict") {
      broadcastEventAttachment = "conflict";
      broadcastEventConflict = {
        existingEventId: attachOutcome.existingEventId,
        requestedEventId: attachOutcome.requestedEventId,
      };
    }

    return {
      sessionId: s.id,
      egressId: (s.livekitEgressId ?? "").trim(),
      destinations: sessionRowsToPrepared(destRows),
      idempotent: true,
      sceneSnapshot: idemScene,
      ...(broadcastEventAttachment
        ? {
            broadcastEventAttachment,
            ...(broadcastEventConflict ? { broadcastEventConflict } : {}),
          }
        : {}),
    };
  }

  const otherLive = await db
    .select({ id: meetBroadcastSessions.id, userId: meetBroadcastSessions.userId })
    .from(meetBroadcastSessions)
    .where(
      and(
        eq(meetBroadcastSessions.roomId, roomId),
        ne(meetBroadcastSessions.userId, params.userId),
        inArray(meetBroadcastSessions.status, [...BROADCAST_LIVE_STATUSES])
      )
    )
    .limit(1);

  if (otherLive[0]) {
    incrementBroadcastRoomBusy({
      userId: params.userId,
      roomId,
      sessionId: null,
    });
    broadcastAudit("broadcast_start_denied_room_busy", {
      roomId,
      userId: params.userId,
      otherUserId: otherLive[0].userId,
    });
    throw broadcastErr(
      "Another broadcaster already has an active session for this room.",
      BROADCAST_CODES.roomBusy
    );
  }

  let destRows = await db
    .select()
    .from(streamDestinations)
    .where(and(eq(streamDestinations.userId, params.userId), eq(streamDestinations.isActive, true)));

  if (params.savedDestinationIds !== undefined) {
    const allow = new Set(params.savedDestinationIds);
    destRows = destRows.filter((r) => allow.has(r.id));
  }

  const usingSaved = destRows.length > 0;
  if (usingSaved && !isStreamDestinationEncryptionConfigured()) {
    throw broadcastErr(
      "Saved stream destinations require STREAM_DESTINATION_ENCRYPTION_KEY to decrypt stored credentials.",
      "broadcast_encryption_unconfigured"
    );
  }

  let preparedSaved: PreparedDestinationRow[] = [];
  if (usingSaved) {
    const { prepared, errors } = prepareDestinationsForEgress(destRows, params.rtmpMeetingLayout);
    if (errors.length > 0 || prepared.length !== destRows.length) {
      incrementBroadcastPreflightFailure({
        userId: params.userId,
        roomId,
        sessionId: null,
      });
      broadcastAudit("broadcast_start_preflight_failed", {
        roomId,
        userId: params.userId,
        activeDestinationCount: destRows.length,
        preparedCount: prepared.length,
        errorSummary: errors.slice(0, 5).join(" | ").slice(0, 500),
        providerCapabilitiesSnapshot: providerCapabilitiesSnapshot(destRows.map((d) => d.platform)),
        warningCount: errors.length,
        degradedAtStart: false,
        sceneLayoutMode: params.sceneSnapshot.layoutMode,
        portraitSafe: params.sceneSnapshot.portraitSafe,
        screenSharePriority: params.sceneSnapshot.screenSharePriority,
        brandingEnabled: brandingEnabled(params.sceneSnapshot),
      });
      throw broadcastErr(
        errors.length
          ? errors.join("; ")
          : "One or more active destinations could not be validated",
        BROADCAST_CODES.destinationInvalid
      );
    }
    preparedSaved = prepared;
  }

  let preparedEphemeral: PreparedDestinationRow[] = [];
  if (params.ephemeralRtmp) {
    const ep = prepareEphemeralRtmpForEgress(params.ephemeralRtmp, params.rtmpMeetingLayout);
    if (!ep.prepared) {
      incrementBroadcastPreflightFailure({
        userId: params.userId,
        roomId,
        sessionId: null,
      });
      broadcastAudit("broadcast_start_preflight_failed", {
        roomId,
        userId: params.userId,
        activeDestinationCount: destRows.length,
        preparedCount: preparedSaved.length,
        errorSummary: (ep.error ?? "one_time_rtmp_invalid").slice(0, 500),
        providerCapabilitiesSnapshot: providerCapabilitiesSnapshot(
          destRows.length ? destRows.map((d) => d.platform) : ["custom"]
        ),
        warningCount: 1,
        degradedAtStart: false,
        sceneLayoutMode: params.sceneSnapshot.layoutMode,
        portraitSafe: params.sceneSnapshot.portraitSafe,
        screenSharePriority: params.sceneSnapshot.screenSharePriority,
        brandingEnabled: brandingEnabled(params.sceneSnapshot),
      });
      throw broadcastErr(ep.error ?? "Invalid one-time RTMP destination.", BROADCAST_CODES.destinationInvalid);
    }
    preparedEphemeral = [ep.prepared];
  }

  const prepared = [...preparedSaved, ...preparedEphemeral];

  if (!prepared.length) {
    throw broadcastErr(
      "No destinations to broadcast: include saved destinations or provide one-time RTMP credentials.",
      BROADCAST_CODES.noDestinations
    );
  }

  const rtmpUrls = prepared.map((p) => p.finalOutputUrl);

  const sceneCfg = sceneConfigFromSnapshot(params.sceneSnapshot);
  const providerHints = {
    platforms: [...new Set(prepared.map((p) => p.platform))],
    anyPortraitCapable: prepared.some((p) => getProviderCapabilities(p.platform).supportsPortrait),
  };
  const wantsV2 = shouldUseRenderedCompositor(sceneCfg, {
    globalEnabled: isRenderedBroadcastCompositorEnabledGlobally(),
    userEnabled: isRenderedBroadcastCompositorEnabledForUser(params.userId),
  });
  const renderModel = wantsV2
    ? buildBroadcastCompositorRenderModel(
        sceneCfg,
        buildBroadcastProgramState(
          sceneCfg,
          { participantIds: [], screenShareTrackPublished: false, primarySpeakerId: null },
          providerHints
        ),
        { platforms: providerHints.platforms }
      )
    : null;

  broadcastAudit("broadcast_start_begin", {
    roomId,
    userId: params.userId,
    destinationIds: prepared
      .map((p) => (p.streamDestinationId != null ? String(p.streamDestinationId) : "ephemeral"))
      .join(","),
    platforms: [...new Set(prepared.map((p) => p.platform))].join(","),
    layoutMode: params.liveKitLayout,
    sceneLayoutMode: params.sceneSnapshot.layoutMode,
    portraitSafe: params.sceneSnapshot.portraitSafe,
    screenSharePriority: params.sceneSnapshot.screenSharePriority,
    brandingEnabled: brandingEnabled(params.sceneSnapshot),
    providerCapabilitiesSnapshot: providerCapabilitiesSnapshot(prepared.map((p) => p.platform)),
    warningCount: totalPreparedWarningCount(prepared),
    degradedAtStart: false,
    compositorMode: wantsV2 ? "v2_rendered_template" : "v1_livekit_default",
    templatePathUsed: false,
    renderSessionRef: null,
  });

  const [sessionInsert] = await db
    .insert(meetBroadcastSessions)
    .values({
      roomId,
      userId: params.userId,
      livekitEgressId: "",
      status: "starting",
      layoutMode: params.liveKitLayout,
      recordingEnabled: params.recordingEnabled,
      sceneConfigJson: params.sceneSnapshot as unknown as Record<string, unknown>,
      startedAt: new Date(),
      compositorMode: wantsV2 ? "v2_rendered_template" : "v1_livekit_default",
      compositorFallbackFromV2: false,
      renderSessionId: null,
      broadcastEventId:
        params.broadcastEventId != null && Number.isFinite(params.broadcastEventId)
          ? Math.floor(params.broadcastEventId)
          : null,
    })
    .$returningId();

  const sessionId = sessionInsert?.id != null ? Number(sessionInsert.id) : NaN;
  if (!Number.isFinite(sessionId)) throw broadcastErr("Failed to create broadcast session", "db_error");

  await db.insert(meetBroadcastSessionDestinations).values(
    prepared.map((p) => ({
      broadcastSessionId: sessionId,
      streamDestinationId: p.streamDestinationId,
      platform: p.platform,
      label: p.label,
      resolvedOutputUrlMasked: p.maskedUrl,
      status: "starting",
      startedAt: new Date(),
    }))
  );

  let customBaseUrl: string | undefined;
  let activeRenderSessionId: number | null = null;
  let compositorModeFinal: "v1_livekit_default" | "v2_rendered_template" = wantsV2
    ? "v2_rendered_template"
    : "v1_livekit_default";

  if (wantsV2 && renderModel) {
    incrementBroadcastCompositorV2Attempt({ userId: params.userId, roomId, sessionId });
    const v2 = await prepareV2RenderedCompositorOrReason({
      userId: params.userId,
      broadcastSessionId: sessionId,
      renderModel,
    });
    if (v2.ok) {
      customBaseUrl = v2.customBaseUrl;
      activeRenderSessionId = v2.renderSessionId;
      await db
        .update(meetBroadcastSessions)
        .set({ renderSessionId: v2.renderSessionId, updatedAt: new Date() })
        .where(eq(meetBroadcastSessions.id, sessionId));
      publishBroadcastTimelineEventSafe({
        broadcastSessionId: sessionId,
        userId: params.userId,
        eventType: "compositor_v2_enabled",
        summary: "V2 rendered compositor active",
        detailsJson: { renderSessionId: v2.renderSessionId },
      });
    } else {
      compositorModeFinal = "v1_livekit_default";
      incrementBroadcastCompositorV2Fallback({
        userId: params.userId,
        roomId,
        sessionId,
        reason: v2.reason,
      });
      await db
        .update(meetBroadcastSessions)
        .set({
          compositorMode: "v1_livekit_default",
          compositorFallbackFromV2: true,
          updatedAt: new Date(),
        })
        .where(eq(meetBroadcastSessions.id, sessionId));
      broadcastAudit("broadcast_compositor_v2_fallback", {
        sessionId,
        roomId,
        userId: params.userId,
        reasonSummary: v2.reason.slice(0, 200),
        compositorMode: "v1_livekit_default",
        templatePathUsed: false,
        renderSessionRef: null,
      });
      publishBroadcastTimelineEventSafe({
        broadcastSessionId: sessionId,
        userId: params.userId,
        eventType: "compositor_v2_fallback",
        summary: "Fell back to V1 compositor",
        detailsJson: { reason: v2.reason.slice(0, 200) },
      });
    }
  }

  try {
    const { egressId } = await startRoomCompositeRtmpFanOut({
      roomName: roomId,
      rtmpUrls,
      layout: params.liveKitLayout,
      customBaseUrl,
      sceneIntent: {
        sceneLayoutMode: params.sceneSnapshot.layoutMode,
        portraitSafe: params.sceneSnapshot.portraitSafe,
        screenSharePriority: params.sceneSnapshot.screenSharePriority,
        brandingEnabled: brandingEnabled(params.sceneSnapshot),
      },
    });

    await db
      .update(meetBroadcastSessions)
      .set({
        livekitEgressId: egressId,
        status: "active",
        updatedAt: new Date(),
      })
      .where(eq(meetBroadcastSessions.id, sessionId));

    await db
      .update(meetBroadcastSessionDestinations)
      .set({ status: "active" })
      .where(eq(meetBroadcastSessionDestinations.broadcastSessionId, sessionId));

    broadcastAudit("broadcast_start_ok", {
      sessionId,
      roomId,
      userId: params.userId,
      egressId: egressId.slice(0, 64),
      destinationCount: prepared.length,
      providerCapabilitiesSnapshot: providerCapabilitiesSnapshot(prepared.map((p) => p.platform)),
      warningCount: totalPreparedWarningCount(prepared),
      degradedAtStart: false,
      sceneLayoutMode: params.sceneSnapshot.layoutMode,
      portraitSafe: params.sceneSnapshot.portraitSafe,
      screenSharePriority: params.sceneSnapshot.screenSharePriority,
      brandingEnabled: brandingEnabled(params.sceneSnapshot),
      compositorMode: compositorModeFinal,
      templatePathUsed: Boolean(customBaseUrl),
      renderSessionRef: activeRenderSessionId != null ? `rs_${activeRenderSessionId}` : null,
    });
    publishBroadcastTimelineEventSafe({
      broadcastSessionId: sessionId,
      userId: params.userId,
      eventType: "session_started",
      summary: `Broadcast started (${prepared.length} destination(s))`,
      detailsJson: {
        destinationCount: prepared.length,
        compositorMode: compositorModeFinal,
        layoutMode: params.liveKitLayout,
        platforms: [...new Set(prepared.map((p) => p.platform))].slice(0, 12),
      },
    });
    publishBroadcastTimelineEventSafe({
      broadcastSessionId: sessionId,
      userId: params.userId,
      eventType: "destination_attached",
      summary: `${prepared.length} output(s) active`,
      detailsJson: {
        count: prepared.length,
        platforms: [...new Set(prepared.map((p) => p.platform))].slice(0, 12),
      },
    });
    if (customBaseUrl) {
      incrementBroadcastCompositorV2Success({
        userId: params.userId,
        roomId,
        sessionId,
      });
    }
    incrementBroadcastStartSuccess({
      userId: params.userId,
      roomId,
      sessionId,
    });

    if (params.scheduleSeedFromTimeline && compositorModeFinal === "v2_rendered_template") {
      const nowIso = new Date().toISOString();
      const built = buildScheduleStateFromTimelineTemplate({
        broadcastSessionId: sessionId,
        userId: params.userId,
        eventStartIso: params.scheduleSeedFromTimeline.eventStartIso,
        template: params.scheduleSeedFromTimeline.template,
        nowIso,
      });
      if (built.ok) {
        try {
          await upsertBroadcastScheduleState(built.state);
          publishScheduleUpdated(sessionId, roomId);
          broadcastAudit("broadcast_schedule_seeded_from_event_timeline", {
            sessionId,
            userId: params.userId,
            roomId,
          });
        } catch (seedErr) {
          broadcastAudit("broadcast_schedule_seed_failed", {
            sessionId,
            userId: params.userId,
            errorSummary: seedErr instanceof Error ? seedErr.message.slice(0, 200) : "unknown",
          });
        }
      } else {
        broadcastAudit("broadcast_schedule_seed_invalid", {
          sessionId,
          userId: params.userId,
          errorSummary: built.errors.join("|").slice(0, 300),
        });
      }
    }

    if (params.broadcastEventId != null && Number.isFinite(params.broadcastEventId)) {
      const eid = Math.floor(params.broadcastEventId);
      try {
        await db
          .update(meetBroadcastEvents)
          .set({ status: "live", updatedAt: new Date() })
          .where(and(eq(meetBroadcastEvents.id, eid), eq(meetBroadcastEvents.userId, params.userId)));
        incrementBroadcastEventLaunch({ userId: params.userId, roomId, sessionId });
        broadcastAudit("broadcast_event_launched", {
          eventId: eid,
          sessionId,
          userId: params.userId,
          roomId,
        });
      } catch {
        /* keep broadcast running */
      }
    }

    return { sessionId, egressId, destinations: prepared, sceneSnapshot: params.sceneSnapshot };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Egress start failed";
    if (customBaseUrl) {
      incrementBroadcastCompositorV2Failure({
        userId: params.userId,
        roomId,
        sessionId,
        reason: msg.slice(0, 200),
      });
    }
    await markSessionTerminalFailed(db, sessionId, msg);
    incrementBroadcastEgressFailure({
      userId: params.userId,
      roomId,
      sessionId,
    });
    broadcastAudit("broadcast_start_egress_failed", {
      sessionId,
      roomId,
      userId: params.userId,
      errorSummary: msg.slice(0, 300),
      providerCapabilitiesSnapshot: providerCapabilitiesSnapshot(prepared.map((p) => p.platform)),
      warningCount: totalPreparedWarningCount(prepared),
      degradedAtStart: false,
      sceneLayoutMode: params.sceneSnapshot.layoutMode,
      portraitSafe: params.sceneSnapshot.portraitSafe,
      screenSharePriority: params.sceneSnapshot.screenSharePriority,
      brandingEnabled: brandingEnabled(params.sceneSnapshot),
      compositorMode: compositorModeFinal,
      templatePathUsed: Boolean(customBaseUrl),
      renderSessionRef: activeRenderSessionId != null ? `rs_${activeRenderSessionId}` : null,
    });
    const err = broadcastErr(msg, BROADCAST_CODES.egressFailed);
    throw err;
  }
}

export async function stopMeetBroadcastSession(params: { userId: number; roomId: string }): Promise<{
  stopped: boolean;
  egressId?: string;
  code?: string;
}> {
  const db = await getDb();
  const roomId = params.roomId.trim();

  const rows = await db
    .select()
    .from(meetBroadcastSessions)
    .where(
      and(
        eq(meetBroadcastSessions.roomId, roomId),
        eq(meetBroadcastSessions.userId, params.userId),
        inArray(meetBroadcastSessions.status, [...BROADCAST_LIVE_STATUSES])
      )
    )
    .limit(1);

  const session = rows[0];
  if (!session) {
    broadcastAudit("broadcast_stop_noop", { roomId, userId: params.userId });
    incrementBroadcastStopNoop({ userId: params.userId, roomId, sessionId: null });
    return { stopped: false, code: BROADCAST_CODES.stopNoop };
  }

  const egressId = session.livekitEgressId?.trim();
  if (egressId) {
    try {
      await stopEgressById(egressId);
    } catch (stopErr) {
      broadcastAudit("broadcast_stop_egress_warn", {
        sessionId: session.id,
        roomId,
        userId: params.userId,
        egressId: egressId.slice(0, 64),
        errorSummary: stopErr instanceof Error ? stopErr.message.slice(0, 200) : "unknown",
      });
    }
  }

  await db
    .update(meetBroadcastSessions)
    .set({
      status: "ended",
      endedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(meetBroadcastSessions.id, session.id));

  await db
    .update(meetBroadcastSessionDestinations)
    .set({
      status: "ended",
      endedAt: new Date(),
    })
    .where(eq(meetBroadcastSessionDestinations.broadcastSessionId, session.id));

  broadcastAudit("broadcast_stop_ok", {
    sessionId: session.id,
    roomId,
    userId: params.userId,
    egressId: egressId ? egressId.slice(0, 64) : null,
  });
  incrementBroadcastStop({ userId: params.userId, roomId, sessionId: session.id });

  publishBroadcastTimelineEventSafe({
    broadcastSessionId: session.id,
    userId: params.userId,
    eventType: "session_stopped",
    summary: "Broadcast stopped by operator",
    detailsJson: { reason: "operator_stop" },
  });

  return { stopped: true, egressId: egressId || undefined, code: BROADCAST_CODES.ok };
}

export async function getMeetBroadcastStatus(params: { userId: number; roomId: string }) {
  const db = await getDb();
  const roomId = params.roomId.trim();

  await reconcileRoomBroadcastSessionsWithLiveKit(db, roomId);

  const live = await db
    .select()
    .from(meetBroadcastSessions)
    .where(
      and(
        eq(meetBroadcastSessions.roomId, roomId),
        eq(meetBroadcastSessions.userId, params.userId),
        inArray(meetBroadcastSessions.status, [...BROADCAST_LIVE_STATUSES])
      )
    )
    .orderBy(desc(meetBroadcastSessions.createdAt))
    .limit(1);

  const session = live[0];
  if (!session) {
    return {
      session: null as null,
      destinations: [] as Array<{
        id: number;
        streamDestinationId: number | null;
        platform: string;
        label: string;
        resolvedOutputUrlMasked: string;
        status: string;
        lastError: string | null;
      }>,
      degraded: false,
      timelinePreview: null as null,
    };
  }

  const timelinePreview = await getBroadcastTimelinePreviewForSession(session.id);

  const dests = await db
    .select()
    .from(meetBroadcastSessionDestinations)
    .where(eq(meetBroadcastSessionDestinations.broadcastSessionId, session.id));

  const mapped = dests.map((d) => ({
    id: d.id,
    streamDestinationId: d.streamDestinationId ?? null,
    platform: d.platform,
    label: d.label,
    resolvedOutputUrlMasked: d.resolvedOutputUrlMasked,
    status: d.status,
    lastError: d.lastError,
  }));

  // Degraded ONLY if a child row explicitly has status "failed" (never infer from missing data / LiveKit gaps).
  const degraded =
    mapped.some((d) => d.status === "failed") &&
    (session.status === "active" || session.status === "starting");

  if (degraded) {
    incrementBroadcastDegraded({
      userId: params.userId,
      roomId,
      sessionId: session.id,
    });
  }

  const sceneSnap = parseStoredSceneSnapshot(session.sceneConfigJson, session.layoutMode);

  const templateActive = isV2LiveSceneControlAvailable(session);

  const nowIso = new Date().toISOString();
  let scheduleSummary: ReturnType<typeof buildScheduleSummaryForStatus> | null = null;
  let scheduleUpdatedAt: string | null = null;
  if (templateActive) {
    const { schedule } = await evaluateBroadcastScheduleForActiveSession(session, nowIso);
    scheduleSummary = buildScheduleSummaryForStatus(schedule, nowIso);
    scheduleUpdatedAt = schedule.updatedAt;
    await evaluateBroadcastAutoDirectingForActiveSession(session as SessionRow, nowIso);
  }

  let liveSceneSummary: {
    sceneType: string;
    layoutMode: string;
    updatedAt: string | null;
    updatedByUserId: number | null;
    customHeadline: string | null;
    customSubheadline: string | null;
  } | null = null;
  if (templateActive) {
    const persisted = await getBroadcastLiveSceneState(session.id);
    const eff = persisted ?? getDefaultLiveSceneStateFromSession(session, session.userId);
    liveSceneSummary = {
      sceneType: eff.sceneType,
      layoutMode: eff.layoutMode,
      updatedAt: persisted ? eff.updatedAt : null,
      updatedByUserId: persisted ? eff.updatedByUserId : null,
      customHeadline: eff.customHeadline ?? null,
      customSubheadline: eff.customSubheadline ?? null,
    };
  }

  let autoDirectingSummary: ReturnType<typeof buildAutoDirectingPublicSummary> = null;
  if (templateActive) {
    const adRow = await getBroadcastAutoDirectingState(session.id);
    autoDirectingSummary = buildAutoDirectingPublicSummary(
      adRow ?? null,
      nowIso
    );
  }

  let overlaySummary: {
    lowerThirdVisible: boolean;
    tickerVisible: boolean;
    ctaBannerVisible: boolean;
    updatedAt: string | null;
  } | null = null;
  if (templateActive) {
    const oPersisted = await getBroadcastOverlayState(session.id);
    const oEff = oPersisted ?? getDefaultOverlayState(session.id, session.userId);
    overlaySummary = {
      lowerThirdVisible: oEff.lowerThird.visible,
      tickerVisible: oEff.ticker.visible,
      ctaBannerVisible: oEff.ctaBanner.visible,
      updatedAt: oPersisted ? oEff.updatedAt : null,
    };
  }

  let broadcastEventSummary: {
    id: number;
    title: string;
    scheduledStartIso: string;
    status: string;
    timelineTemplateName: string | null;
    launchedFromEvent: boolean;
    calendarLink: ReturnType<typeof toBroadcastCalendarLinkSummary> | null;
  } | null = null;
  const linkedEventId = session.broadcastEventId;
  if (linkedEventId != null && Number.isFinite(Number(linkedEventId))) {
    const ev = await getBroadcastEventById(Number(linkedEventId), session.userId);
    if (ev) {
      let timelineTemplateName: string | null = null;
      if (ev.defaultTimelineTemplateId != null) {
        const tt = await getTimelineTemplateById(ev.defaultTimelineTemplateId, session.userId);
        timelineTemplateName = tt?.name ?? null;
      }
      const cal = await getBroadcastCalendarLinkByBroadcastEventId(ev.id, session.userId);
      broadcastEventSummary = {
        id: ev.id,
        title: ev.title,
        scheduledStartIso: ev.scheduledStartIso,
        status: ev.status,
        timelineTemplateName,
        launchedFromEvent: true,
        calendarLink: cal ? toBroadcastCalendarLinkSummary(cal) : null,
      };
    }
  }

  return {
    session: {
      id: session.id,
      roomId: session.roomId,
      livekitEgressId: session.livekitEgressId,
      status: session.status,
      startedAt: session.startedAt,
      endedAt: session.endedAt,
      layoutMode: session.layoutMode,
      recordingEnabled: Boolean(session.recordingEnabled),
      scenePreview: {
        layoutMode: sceneSnap.layoutMode,
        portraitSafe: sceneSnap.portraitSafe,
        brandingEnabled: brandingEnabled(sceneSnap),
        screenSharePriority: sceneSnap.screenSharePriority,
        presetName: sceneSnap.appliedPresetName ?? null,
        compositorMode: session.compositorMode ?? "v1_livekit_default",
        compositorFallbackFromV2: Boolean(session.compositorFallbackFromV2),
        renderSessionMasked:
          session.renderSessionId != null ? `rs_****${String(session.renderSessionId).slice(-2)}` : null,
        templateActive,
        brandingRendered:
          (session.compositorMode ?? "v1_livekit_default") === "v2_rendered_template" &&
          session.renderSessionId != null &&
          !session.compositorFallbackFromV2 &&
          brandingEnabled(sceneSnap),
        liveScene: liveSceneSummary,
        overlaySummary,
        scheduleSummary,
        scheduleUpdatedAt,
        autoDirectingSummary,
        broadcastEventSummary,
      },
    },
    destinations: mapped,
    degraded,
    timelinePreview,
  };
}

/** Test helper: build RTMP URL list the same way as egress (pure over decrypted keys). */
export function buildBroadcastRtmpUrlList(
  rows: Array<{
    platform: string;
    serverUrl: string;
    streamKey: string;
    streamKeyLast4: string;
    orientationPreference: string;
  }>,
  layoutMode: string
): { urls: string[]; masked: string[]; platforms: StreamPlatform[] } {
  const urls: string[] = [];
  const masked: string[] = [];
  const platforms: StreamPlatform[] = [];
  for (const row of rows) {
    const platform = normalizeStreamPlatform(row.platform);
    if (!platform) continue;
    const r = resolveRtmpDestination({
      platform,
      serverUrl: row.serverUrl,
      streamKey: row.streamKey,
      meetingLayout: layoutMode,
      orientationPreference: row.orientationPreference,
    });
    if (!r.finalOutputUrl || !isValidRtmpIngestUrl(r.finalOutputUrl)) continue;
    urls.push(r.finalOutputUrl);
    masked.push(maskRtmpOutputUrl(r.finalOutputUrl, row.streamKeyLast4));
    platforms.push(platform);
  }
  return { urls, masked, platforms };
}
