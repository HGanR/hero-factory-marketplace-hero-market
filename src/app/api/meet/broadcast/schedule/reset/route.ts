import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getAuthedUserId } from "@/lib/api/auth";
import { getDb } from "@/lib/db";
import { meetBroadcastSessions } from "@/lib/db/schema";
import { assertMeetBroadcastHost } from "@/lib/meet/broadcast-host";
import { BROADCAST_CODES } from "@/lib/meet/broadcast-codes";
import { BROADCAST_LIVE_STATUSES } from "@/lib/meet/broadcast-constants";
import { broadcastAudit } from "@/lib/meet/broadcast-audit";
import { incrementBroadcastScheduleError, incrementBroadcastScheduleReset } from "@/lib/meet/broadcast-metrics";
import { isV2LiveSceneControlAvailable } from "@/lib/meet/broadcast-live-scenes";
import { getDefaultBroadcastScheduleState, buildScheduleSummaryForStatus } from "@/lib/meet/broadcast-schedule";
import { resetBroadcastScheduleState } from "@/lib/meet/broadcast-schedule-store";
import { publishScheduleUpdated } from "@/lib/meet/broadcast-event-publisher";

type PostBody = {
  broadcastSessionId?: number | string;
  hostWallet?: string | null;
};

async function loadAuthorizedSession(
  userId: number,
  broadcastSessionId: number
): Promise<
  | { ok: true; session: typeof meetBroadcastSessions.$inferSelect }
  | { ok: false; status: number; code: string; message: string }
> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(meetBroadcastSessions)
    .where(eq(meetBroadcastSessions.id, broadcastSessionId))
    .limit(1);
  const session = rows[0];
  if (!session) {
    return {
      ok: false,
      status: 404,
      code: BROADCAST_CODES.scheduleSessionNotFound,
      message: "Broadcast session not found",
    };
  }
  if (session.userId !== userId) {
    broadcastAudit("broadcast_schedule_denied", {
      broadcastSessionId,
      userId,
      reason: "owner_mismatch",
    });
    incrementBroadcastScheduleError({ userId, sessionId: broadcastSessionId, reason: "owner_mismatch" });
    return {
      ok: false,
      status: 403,
      code: BROADCAST_CODES.scheduleHostMismatch,
      message: "Not allowed for this session",
    };
  }
  if (!BROADCAST_LIVE_STATUSES.includes(session.status as (typeof BROADCAST_LIVE_STATUSES)[number])) {
    return {
      ok: false,
      status: 409,
      code: BROADCAST_CODES.scheduleNotActive,
      message: "Broadcast is not active",
    };
  }
  if (!isV2LiveSceneControlAvailable(session)) {
    return {
      ok: false,
      status: 409,
      code: BROADCAST_CODES.scheduleNotSupported,
      message: "Schedule requires an active V2 rendered compositor session",
    };
  }
  return { ok: true, session };
}

/**
 * POST /api/meet/broadcast/schedule/reset
 * Clears persisted schedule row; does not change live scene or overlays.
 */
export async function POST(req: NextRequest) {
  const userId = await getAuthedUserId();
  if (userId == null) {
    return NextResponse.json(
      { ok: false, code: BROADCAST_CODES.notAuthenticated, error: "Unauthorized" },
      { status: 401 }
    );
  }

  let body: PostBody;
  try {
    body = (await req.json()) as PostBody;
  } catch {
    broadcastAudit("broadcast_schedule_invalid", { userId, reason: "bad_json" });
    incrementBroadcastScheduleError({ userId, sessionId: null, reason: "bad_json" });
    return NextResponse.json(
      { ok: false, code: BROADCAST_CODES.scheduleInvalid, error: "Invalid JSON" },
      { status: 400 }
    );
  }

  const sid = body.broadcastSessionId;
  const broadcastSessionIdNum =
    typeof sid === "string" ? Number(String(sid).trim()) : typeof sid === "number" ? sid : Number.NaN;
  if (!Number.isFinite(broadcastSessionIdNum) || broadcastSessionIdNum <= 0) {
    broadcastAudit("broadcast_schedule_invalid", { userId, reason: "bad_session_id" });
    incrementBroadcastScheduleError({ userId, sessionId: null, reason: "bad_session_id" });
    return NextResponse.json(
      { ok: false, code: BROADCAST_CODES.scheduleInvalid, error: "broadcastSessionId is required" },
      { status: 400 }
    );
  }
  const broadcastSessionId = broadcastSessionIdNum;

  const host = await assertMeetBroadcastHost(userId, body.hostWallet ?? null);
  if (!host.ok) {
    broadcastAudit("broadcast_schedule_denied", { broadcastSessionId, userId, reason: "host_wallet" });
    incrementBroadcastScheduleError({ userId, sessionId: broadcastSessionId, reason: "host_wallet" });
    return NextResponse.json({ ok: false, code: host.code, error: host.error }, { status: host.status });
  }

  const auth = await loadAuthorizedSession(userId, broadcastSessionId);
  if (!auth.ok) {
    incrementBroadcastScheduleError({ userId, sessionId: broadcastSessionId, reason: auth.code });
    return NextResponse.json(
      { ok: false, code: auth.code, error: auth.message },
      { status: auth.status }
    );
  }

  await resetBroadcastScheduleState(broadcastSessionId);

  broadcastAudit("broadcast_schedule_reset", {
    broadcastSessionId,
    userId,
  });
  incrementBroadcastScheduleReset({ userId, sessionId: broadcastSessionId, roomId: auth.session.roomId });

  publishScheduleUpdated(broadcastSessionId, auth.session.roomId);

  const defaultState = getDefaultBroadcastScheduleState(broadcastSessionId, userId);
  const nowIso = new Date().toISOString();
  const summary = buildScheduleSummaryForStatus(defaultState, nowIso);

  return NextResponse.json({ ok: true, state: defaultState, summary, persisted: false });
}
