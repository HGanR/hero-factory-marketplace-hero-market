import { NextRequest, NextResponse } from "next/server";
import { getAuthedUserId } from "@/lib/api/auth";
import { assertMeetBroadcastHost } from "@/lib/meet/broadcast-host";
import { startMeetBroadcastSession } from "@/lib/meet/broadcast-service";
import { livekitHttpHostFromEnv } from "@/lib/streaming/livekit-egress";
import { BROADCAST_CODES } from "@/lib/meet/broadcast-codes";

const EPHEMERAL_IGNORED_IDEMPOTENT_REASON = BROADCAST_CODES.ephemeralIgnoredIdempotentActiveSession;
import { incrementBroadcastStartAttempt } from "@/lib/meet/broadcast-metrics";
import { resolveBroadcastStartScene } from "@/lib/meet/broadcast-start-scene";
import { mapBroadcastSceneToLiveKitLayout } from "@/lib/meet/broadcast-scene";
import { getBroadcastEventById } from "@/lib/meet/broadcast-event-store";
import { getTimelineTemplateById } from "@/lib/meet/broadcast-timeline-templates";
import type { BroadcastTimelineTemplateBody } from "@/lib/meet/broadcast-timeline-template";

type StartBody = {
  roomId?: string;
  /** Legacy LiveKit layout (grid | speaker | single-speaker) when no sceneConfig / preset. */
  layoutMode?: string;
  recordingEnabled?: boolean;
  hostWallet?: string;
  scenePresetId?: string | number | null;
  sceneConfig?: unknown;
  /** When set, loads event defaults for room / preset / timeline seeding (explicit body fields override). */
  broadcastEventId?: string | number | null;
  /**
   * **undefined**: all active saved destinations (default).
   * **[]**: no saved destinations (use with `ephemeralRtmp` for one-time-only start).
   * **non-empty**: subset of saved destination ids (must be active).
   */
  savedDestinationIds?: unknown;
  /** One-time RTMP target for this launch — never persisted; omit `streamKey` to skip. */
  ephemeralRtmp?: unknown;
};

function parseSavedDestinationIds(raw: unknown): number[] | undefined {
  if (raw === undefined) return undefined;
  if (!Array.isArray(raw)) return undefined;
  const ids: number[] = [];
  for (const x of raw) {
    const n = typeof x === "number" ? x : Number(x);
    if (Number.isFinite(n) && n > 0) ids.push(Math.floor(n));
  }
  return ids;
}

function parseEphemeralRtmp(raw: unknown): {
  serverUrl: string;
  streamKey: string;
  platform?: string;
  label?: string;
  orientationPreference?: string;
} | null {
  if (raw == null || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const streamKey = String(o.streamKey ?? "").trim();
  if (!streamKey) return null;
  return {
    serverUrl: String(o.serverUrl ?? "").trim(),
    streamKey,
    platform: o.platform != null ? String(o.platform).trim() : undefined,
    label: o.label != null ? String(o.label).trim().slice(0, 120) : undefined,
    orientationPreference:
      o.orientationPreference != null ? String(o.orientationPreference).trim() : undefined,
  };
}

export async function POST(req: NextRequest) {
  const userId = await getAuthedUserId();
  if (userId == null) {
    return NextResponse.json(
      { code: BROADCAST_CODES.notAuthenticated, error: "Unauthorized" },
      { status: 401 }
    );
  }

  if (!livekitHttpHostFromEnv() || !process.env.LIVEKIT_API_KEY || !process.env.LIVEKIT_API_SECRET) {
    return NextResponse.json(
      { code: "broadcast_livekit_unconfigured", error: "LiveKit not configured" },
      { status: 503 }
    );
  }

  let body: StartBody;
  try {
    body = (await req.json()) as StartBody;
  } catch {
    return NextResponse.json(
      { code: "broadcast_bad_request", error: "Invalid JSON" },
      { status: 400 }
    );
  }

  const rawEvent = body.broadcastEventId;
  let linkedEventId: number | null = null;
  let linkedEvent: Awaited<ReturnType<typeof getBroadcastEventById>> = null;
  if (rawEvent != null && String(rawEvent).trim() !== "" && Number.isFinite(Number(rawEvent))) {
    linkedEventId = Math.floor(Number(rawEvent));
    linkedEvent = await getBroadcastEventById(linkedEventId, userId);
    if (!linkedEvent) {
      return NextResponse.json(
        { code: BROADCAST_CODES.broadcastEventNotFound, error: "Broadcast event not found" },
        { status: 404 }
      );
    }
    if (linkedEvent.status === "cancelled" || linkedEvent.status === "completed") {
      return NextResponse.json(
        { code: BROADCAST_CODES.broadcastEventInvalid, error: "Event is not launchable" },
        { status: 409 }
      );
    }
  }

  let roomId = (body.roomId ?? "").trim();
  if (!roomId && linkedEvent?.roomId?.trim()) {
    roomId = linkedEvent.roomId.trim();
  }
  if (!roomId) {
    return NextResponse.json(
      { code: "broadcast_bad_request", error: "roomId is required (or set on the broadcast event)" },
      { status: 400 }
    );
  }

  const host = await assertMeetBroadcastHost(userId, body.hostWallet ?? null);
  if (!host.ok) {
    return NextResponse.json({ code: host.code, error: host.error }, { status: host.status });
  }

  incrementBroadcastStartAttempt({ userId, roomId, sessionId: null });

  const explicitPreset = Object.prototype.hasOwnProperty.call(body, "scenePresetId");
  const explicitConfig = Object.prototype.hasOwnProperty.call(body, "sceneConfig");

  let scenePresetIdForResolve: number | null;
  if (explicitPreset) {
    const rawPreset = body.scenePresetId;
    if (rawPreset === null || (typeof rawPreset === "string" && rawPreset.trim() === "")) {
      scenePresetIdForResolve = null;
    } else if (Number.isFinite(Number(rawPreset))) {
      scenePresetIdForResolve = Number(rawPreset);
    } else {
      scenePresetIdForResolve = null;
    }
  } else if (!explicitConfig && linkedEvent?.scenePresetId != null) {
    scenePresetIdForResolve = linkedEvent.scenePresetId;
  } else {
    scenePresetIdForResolve = null;
  }

  const sceneConfigForResolve = explicitConfig ? body.sceneConfig : undefined;

  let resolved;
  try {
    resolved = await resolveBroadcastStartScene({
      userId,
      scenePresetId: scenePresetIdForResolve,
      sceneConfig: sceneConfigForResolve,
      legacyLayoutMode: body.layoutMode ?? null,
    });
  } catch (e) {
    const err = e as Error & { code?: string };
    if (err.code === "broadcast_scene_invalid") {
      return NextResponse.json({ code: err.code, error: err.message }, { status: 400 });
    }
    throw e;
  }

  let scheduleSeedFromTimeline: {
    eventStartIso: string;
    template: BroadcastTimelineTemplateBody;
  } | null = null;
  if (linkedEvent?.defaultTimelineTemplateId != null) {
    const tt = await getTimelineTemplateById(linkedEvent.defaultTimelineTemplateId, userId);
    if (tt) {
      scheduleSeedFromTimeline = {
        eventStartIso: linkedEvent.scheduledStartIso,
        template: tt.template,
      };
    }
  }

  const savedDestinationIds = parseSavedDestinationIds(body.savedDestinationIds);
  const ephemeralRtmp = parseEphemeralRtmp(body.ephemeralRtmp);

  try {
    const result = await startMeetBroadcastSession({
      userId,
      roomId,
      liveKitLayout: resolved.liveKitLayout,
      rtmpMeetingLayout: resolved.rtmpMeetingLayout,
      recordingEnabled: Boolean(body.recordingEnabled),
      sceneSnapshot: resolved.snapshot,
      broadcastEventId: linkedEventId,
      scheduleSeedFromTimeline,
      savedDestinationIds,
      ephemeralRtmp,
    });
    const scene = result.sceneSnapshot ?? resolved.snapshot;
    const sceneWarnings = result.idempotent
      ? mapBroadcastSceneToLiveKitLayout(scene.layoutMode).egressMappingWarnings
      : resolved.resolveWarnings;
    const code =
      result.broadcastEventAttachment === "conflict"
        ? BROADCAST_CODES.broadcastEventIdempotentConflict
        : BROADCAST_CODES.ok;
    const ephemeralRtmpIgnored = Boolean(result.idempotent) && ephemeralRtmp != null;
    return NextResponse.json({
      ok: true,
      code,
      idempotent: Boolean(result.idempotent),
      sessionId: result.sessionId,
      egressId: result.egressId,
      scene,
      sceneWarnings,
      broadcastEventId: linkedEventId,
      ...(result.idempotent
        ? {
            broadcastEventAttachment: result.broadcastEventAttachment ?? null,
            broadcastEventConflict: result.broadcastEventConflict ?? null,
          }
        : {}),
      ...(ephemeralRtmpIgnored
        ? {
            ephemeralRtmpIgnored: true,
            ephemeralRtmpIgnoredReason: EPHEMERAL_IGNORED_IDEMPOTENT_REASON,
          }
        : {}),
      destinations: result.destinations.map((d) => ({
        streamDestinationId: d.streamDestinationId,
        platform: d.platform,
        label: d.label,
        maskedUrl: d.maskedUrl,
        warnings: d.warnings,
      })),
    });
  } catch (e) {
    const err = e as Error & { code?: string };
    if (err.code === "broadcast_encryption_unconfigured") {
      return NextResponse.json({ code: err.code, error: err.message }, { status: 503 });
    }
    if (err.code === BROADCAST_CODES.roomBusy) {
      return NextResponse.json({ code: err.code, error: err.message }, { status: 409 });
    }
    if (err.code === BROADCAST_CODES.noDestinations) {
      return NextResponse.json({ code: err.code, error: err.message }, { status: 400 });
    }
    if (err.code === BROADCAST_CODES.destinationInvalid) {
      return NextResponse.json({ code: err.code, error: err.message }, { status: 400 });
    }
    if (err.code === BROADCAST_CODES.egressFailed) {
      return NextResponse.json({ code: err.code, error: err.message }, { status: 503 });
    }
    if (err.code === "validation_error") {
      return NextResponse.json({ code: "broadcast_bad_request", error: err.message }, { status: 400 });
    }
    console.error("[meet/broadcast/start]", e);
    return NextResponse.json(
      { code: BROADCAST_CODES.egressFailed, error: err.message || "Broadcast failed" },
      { status: 503 }
    );
  }
}
