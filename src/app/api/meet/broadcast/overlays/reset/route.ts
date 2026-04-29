import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getAuthedUserId } from "@/lib/api/auth";
import { getDb } from "@/lib/db";
import { meetBroadcastSessions } from "@/lib/db/schema";
import { assertMeetBroadcastHost } from "@/lib/meet/broadcast-host";
import { BROADCAST_CODES } from "@/lib/meet/broadcast-codes";
import { BROADCAST_LIVE_STATUSES } from "@/lib/meet/broadcast-constants";
import { broadcastAudit } from "@/lib/meet/broadcast-audit";
import { incrementBroadcastOverlayError, incrementBroadcastOverlayReset } from "@/lib/meet/broadcast-metrics";
import { isV2LiveSceneControlAvailable } from "@/lib/meet/broadcast-live-scenes";
import { getDefaultOverlayState } from "@/lib/meet/broadcast-overlays";
import { resetBroadcastOverlayState } from "@/lib/meet/broadcast-overlay-store";
import { publishOverlaysUpdated } from "@/lib/meet/broadcast-event-publisher";
import { publishBroadcastTimelineEventSafe } from "@/lib/meet/broadcast-timeline-publisher";

type Body = { broadcastSessionId?: number | string; hostWallet?: string | null };

/**
 * POST /api/meet/broadcast/overlays/reset
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
      { ok: false, code: BROADCAST_CODES.overlayInvalid, error: "Invalid JSON" },
      { status: 400 }
    );
  }

  const sid = body.broadcastSessionId;
  const broadcastSessionId = typeof sid === "string" ? Number(sid) : sid;
  if (!Number.isFinite(broadcastSessionId) || broadcastSessionId <= 0) {
    return NextResponse.json(
      { ok: false, code: BROADCAST_CODES.overlayInvalid, error: "broadcastSessionId is required" },
      { status: 400 }
    );
  }

  const host = await assertMeetBroadcastHost(userId, body.hostWallet ?? null);
  if (!host.ok) {
    incrementBroadcastOverlayError({ userId, sessionId: broadcastSessionId, reason: "host_wallet" });
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
      { ok: false, code: BROADCAST_CODES.overlaySessionNotFound, error: "Broadcast session not found" },
      { status: 404 }
    );
  }
  if (session.userId !== userId) {
    broadcastAudit("broadcast_overlay_denied", { broadcastSessionId, userId, reason: "owner_mismatch_reset" });
    incrementBroadcastOverlayError({ userId, sessionId: broadcastSessionId, reason: "owner_mismatch" });
    return NextResponse.json(
      { ok: false, code: BROADCAST_CODES.overlayHostMismatch, error: "Not allowed for this session" },
      { status: 403 }
    );
  }
  if (!BROADCAST_LIVE_STATUSES.includes(session.status as (typeof BROADCAST_LIVE_STATUSES)[number])) {
    return NextResponse.json(
      { ok: false, code: BROADCAST_CODES.overlayNotActive, error: "Broadcast is not active" },
      { status: 409 }
    );
  }
  if (!isV2LiveSceneControlAvailable(session)) {
    broadcastAudit("broadcast_overlay_denied", { broadcastSessionId, userId, reason: "v2_required_reset" });
    incrementBroadcastOverlayError({ userId, sessionId: broadcastSessionId, reason: "not_v2" });
    return NextResponse.json(
      { ok: false, code: BROADCAST_CODES.overlayNotSupported, error: "Overlays require an active V2 rendered compositor session" },
      { status: 409 }
    );
  }

  try {
    await resetBroadcastOverlayState(broadcastSessionId);
  } catch (e) {
    const msg = e instanceof Error ? e.message.slice(0, 200) : "reset_failed";
    incrementBroadcastOverlayError({ userId, sessionId: broadcastSessionId, reason: msg });
    return NextResponse.json(
      { ok: false, code: BROADCAST_CODES.overlayInvalid, error: "Could not reset overlay state" },
      { status: 503 }
    );
  }

  const state = getDefaultOverlayState(broadcastSessionId, userId);
  broadcastAudit("broadcast_overlay_reset", { broadcastSessionId, userId });
  incrementBroadcastOverlayReset({ userId, sessionId: broadcastSessionId, roomId: session.roomId });

  publishOverlaysUpdated(broadcastSessionId, session.roomId);

  publishBroadcastTimelineEventSafe({
    broadcastSessionId,
    userId,
    eventType: "overlay_reset",
    summary: "Overlays reset to defaults",
    detailsJson: {},
  });

  return NextResponse.json({ ok: true, state });
}
