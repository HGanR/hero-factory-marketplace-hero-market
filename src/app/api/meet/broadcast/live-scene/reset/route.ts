import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getAuthedUserId } from "@/lib/api/auth";
import { getDb } from "@/lib/db";
import { meetBroadcastSessions } from "@/lib/db/schema";
import { assertMeetBroadcastHost } from "@/lib/meet/broadcast-host";
import { BROADCAST_CODES } from "@/lib/meet/broadcast-codes";
import { BROADCAST_LIVE_STATUSES } from "@/lib/meet/broadcast-constants";
import { broadcastAudit } from "@/lib/meet/broadcast-audit";
import {
  incrementBroadcastLiveSceneError,
  incrementBroadcastLiveSceneReset,
} from "@/lib/meet/broadcast-metrics";
import {
  getDefaultLiveSceneStateFromSession,
  isV2LiveSceneControlAvailable,
} from "@/lib/meet/broadcast-live-scenes";
import { resetBroadcastLiveSceneStateToProgram } from "@/lib/meet/broadcast-live-scene-store";
import { publishLiveSceneUpdated } from "@/lib/meet/broadcast-event-publisher";
import { publishBroadcastTimelineEventSafe } from "@/lib/meet/broadcast-timeline-publisher";

type Body = { broadcastSessionId?: number | string; hostWallet?: string | null };

/**
 * POST /api/meet/broadcast/live-scene/reset
 * Clears persisted overrides; template/status fall back to program default from session snapshot.
 */
export async function POST(req: NextRequest) {
  const userId = await getAuthedUserId();
  if (userId == null) {
    return NextResponse.json(
      { ok: false, code: BROADCAST_CODES.notAuthenticated, error: "Unauthorized" },
      { status: 401 }
    );
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json(
      { ok: false, code: BROADCAST_CODES.liveSceneInvalid, error: "Invalid JSON" },
      { status: 400 }
    );
  }

  const sid = body.broadcastSessionId;
  const broadcastSessionIdNum =
    typeof sid === "string" ? Number(String(sid).trim()) : typeof sid === "number" ? sid : Number.NaN;
  if (!Number.isFinite(broadcastSessionIdNum) || broadcastSessionIdNum <= 0) {
    return NextResponse.json(
      { ok: false, code: BROADCAST_CODES.liveSceneInvalid, error: "broadcastSessionId is required" },
      { status: 400 }
    );
  }
  const broadcastSessionId = broadcastSessionIdNum;

  const host = await assertMeetBroadcastHost(userId, body.hostWallet ?? null);
  if (!host.ok) {
    incrementBroadcastLiveSceneError({ userId, sessionId: broadcastSessionId, reason: "host_wallet" });
    return NextResponse.json({ ok: false, code: host.code, error: host.error }, { status: host.status });
  }

  const db = await getDb();
  const rows = await db
    .select()
    .from(meetBroadcastSessions)
    .where(eq(meetBroadcastSessions.id, broadcastSessionId))
    .limit(1);
  const session = rows[0];
  if (!session) {
    return NextResponse.json(
      { ok: false, code: BROADCAST_CODES.liveSceneSessionNotFound, error: "Broadcast session not found" },
      { status: 404 }
    );
  }
  if (session.userId !== userId) {
    broadcastAudit("broadcast_live_scene_denied", { broadcastSessionId, userId, reason: "owner_mismatch_reset" });
    incrementBroadcastLiveSceneError({ userId, sessionId: broadcastSessionId, reason: "owner_mismatch" });
    return NextResponse.json(
      { ok: false, code: BROADCAST_CODES.liveSceneHostMismatch, error: "Not allowed for this session" },
      { status: 403 }
    );
  }
  if (!BROADCAST_LIVE_STATUSES.includes(session.status as (typeof BROADCAST_LIVE_STATUSES)[number])) {
    return NextResponse.json(
      { ok: false, code: BROADCAST_CODES.liveSceneNotActive, error: "Broadcast is not active" },
      { status: 409 }
    );
  }
  if (!isV2LiveSceneControlAvailable(session)) {
    broadcastAudit("broadcast_live_scene_denied", { broadcastSessionId, userId, reason: "v2_required_reset" });
    incrementBroadcastLiveSceneError({ userId, sessionId: broadcastSessionId, reason: "not_v2" });
    return NextResponse.json(
      { ok: false, code: BROADCAST_CODES.liveSceneNotSupported, error: "Live scene control requires an active V2 rendered compositor session" },
      { status: 409 }
    );
  }

  try {
    await resetBroadcastLiveSceneStateToProgram(broadcastSessionId);
  } catch (e) {
    const msg = e instanceof Error ? e.message.slice(0, 200) : "reset_failed";
    incrementBroadcastLiveSceneError({ userId, sessionId: broadcastSessionId, reason: msg });
    return NextResponse.json(
      { ok: false, code: BROADCAST_CODES.liveSceneInvalid, error: "Could not reset live scene state" },
      { status: 503 }
    );
  }

  const state = getDefaultLiveSceneStateFromSession(session, userId);
  broadcastAudit("broadcast_live_scene_reset", {
    broadcastSessionId,
    userId,
  });
  incrementBroadcastLiveSceneReset({ userId, sessionId: broadcastSessionId, roomId: session.roomId });

  publishLiveSceneUpdated(broadcastSessionId, session.roomId);

  publishBroadcastTimelineEventSafe({
    broadcastSessionId,
    userId,
    eventType: "live_scene_reset",
    summary: "Live scene reset to program default",
    detailsJson: { sceneType: state.sceneType, layoutMode: state.layoutMode },
  });

  return NextResponse.json({ ok: true, state });
}
