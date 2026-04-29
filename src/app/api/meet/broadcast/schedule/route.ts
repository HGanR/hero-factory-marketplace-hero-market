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
  incrementBroadcastScheduleChange,
  incrementBroadcastScheduleError,
} from "@/lib/meet/broadcast-metrics";
import { isV2LiveSceneControlAvailable } from "@/lib/meet/broadcast-live-scenes";
import {
  buildScheduleSummaryForStatus,
  getDefaultBroadcastScheduleState,
  mergeBroadcastSchedulePatch,
  validateBroadcastScheduleState,
  type BroadcastSchedulePatch,
} from "@/lib/meet/broadcast-schedule";
import {
  getBroadcastScheduleState,
  upsertBroadcastScheduleState,
} from "@/lib/meet/broadcast-schedule-store";
import { evaluateBroadcastScheduleForActiveSession } from "@/lib/meet/broadcast-scheduler";
import { publishCountdownUpdated, publishScheduleUpdated } from "@/lib/meet/broadcast-event-publisher";
import { publishBroadcastTimelineEventSafe } from "@/lib/meet/broadcast-timeline-publisher";

type PostBody = {
  broadcastSessionId?: number | string;
  hostWallet?: string | null;
} & BroadcastSchedulePatch;

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
 * GET /api/meet/broadcast/schedule?broadcastSessionId=&hostWallet=
 */
export async function GET(req: NextRequest) {
  const userId = await getAuthedUserId();
  if (userId == null) {
    return NextResponse.json(
      { ok: false, code: BROADCAST_CODES.notAuthenticated, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const broadcastSessionIdRaw = req.nextUrl.searchParams.get("broadcastSessionId")?.trim() ?? "";
  const broadcastSessionId = Number(broadcastSessionIdRaw);
  if (!Number.isFinite(broadcastSessionId) || broadcastSessionId <= 0) {
    return NextResponse.json(
      { ok: false, code: BROADCAST_CODES.scheduleInvalid, error: "Invalid broadcastSessionId" },
      { status: 400 }
    );
  }

  const hostWallet = req.nextUrl.searchParams.get("hostWallet");
  const host = await assertMeetBroadcastHost(userId, hostWallet);
  if (!host.ok) {
    return NextResponse.json({ ok: false, code: host.code, error: host.error }, { status: host.status });
  }

  const auth = await loadAuthorizedSession(userId, broadcastSessionId);
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, code: auth.code, error: auth.message },
      { status: auth.status }
    );
  }

  const nowIso = new Date().toISOString();
  const { schedule } = await evaluateBroadcastScheduleForActiveSession(auth.session, nowIso);
  const persisted = Boolean(await getBroadcastScheduleState(broadcastSessionId));
  const summary = buildScheduleSummaryForStatus(schedule, nowIso);

  return NextResponse.json({ ok: true, state: schedule, summary, persisted });
}

/**
 * POST /api/meet/broadcast/schedule
 * Partial body: automationEnabled, countdown, actions (replaces actions array when sent).
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
  const broadcastSessionId = typeof sid === "string" ? Number(sid) : sid;
  if (!Number.isFinite(broadcastSessionId) || broadcastSessionId <= 0) {
    broadcastAudit("broadcast_schedule_invalid", { userId, reason: "bad_session_id" });
    incrementBroadcastScheduleError({ userId, sessionId: null, reason: "bad_session_id" });
    return NextResponse.json(
      { ok: false, code: BROADCAST_CODES.scheduleInvalid, error: "broadcastSessionId is required" },
      { status: 400 }
    );
  }

  const host = await assertMeetBroadcastHost(userId, body.hostWallet ?? null);
  if (!host.ok) {
    broadcastAudit("broadcast_schedule_denied", { broadcastSessionId, userId, reason: "host_wallet" });
    incrementBroadcastScheduleError({ userId, sessionId: broadcastSessionId, reason: "host_wallet" });
    return NextResponse.json({ ok: false, code: host.code, error: host.error }, { status: host.status });
  }

  const auth = await loadAuthorizedSession(userId, broadcastSessionId);
  if (!auth.ok) {
    if (auth.code === BROADCAST_CODES.scheduleSessionNotFound) {
      broadcastAudit("broadcast_schedule_denied", { broadcastSessionId, userId, reason: "session_not_found" });
    }
    if (auth.code === BROADCAST_CODES.scheduleNotActive) {
      broadcastAudit("broadcast_schedule_denied", { broadcastSessionId, userId, reason: "not_active" });
    }
    if (auth.code === BROADCAST_CODES.scheduleNotSupported) {
      broadcastAudit("broadcast_schedule_denied", { broadcastSessionId, userId, reason: "v2_required" });
    }
    incrementBroadcastScheduleError({ userId, sessionId: broadcastSessionId, reason: auth.code });
    return NextResponse.json(
      { ok: false, code: auth.code, error: auth.message },
      { status: auth.status }
    );
  }

  const patch: BroadcastSchedulePatch = {};
  if (body.automationEnabled !== undefined) patch.automationEnabled = body.automationEnabled;
  if (body.countdown !== undefined) patch.countdown = body.countdown;
  if (body.actions !== undefined) patch.actions = body.actions;

  if (
    patch.automationEnabled === undefined &&
    patch.countdown === undefined &&
    patch.actions === undefined
  ) {
    broadcastAudit("broadcast_schedule_invalid", { broadcastSessionId, userId, reason: "empty_patch" });
    incrementBroadcastScheduleError({ userId, sessionId: broadcastSessionId, reason: "empty_patch" });
    return NextResponse.json(
      { ok: false, code: BROADCAST_CODES.scheduleInvalid, error: "No schedule fields to update" },
      { status: 400 }
    );
  }

  const persistedRow = await getBroadcastScheduleState(broadcastSessionId);
  const base = persistedRow ?? getDefaultBroadcastScheduleState(broadcastSessionId, userId);
  const merged = mergeBroadcastSchedulePatch(base, patch);
  const now = new Date().toISOString();
  const nextState = {
    ...merged,
    updatedAt: now,
    updatedByUserId: userId,
    broadcastSessionId,
  };
  const validated = validateBroadcastScheduleState(nextState);
  if (!validated.ok) {
    broadcastAudit("broadcast_schedule_invalid", {
      broadcastSessionId,
      userId,
      reason: validated.errors.join("|").slice(0, 400),
    });
    incrementBroadcastScheduleError({ userId, sessionId: broadcastSessionId, reason: "validation" });
    return NextResponse.json(
      { ok: false, code: BROADCAST_CODES.scheduleInvalid, error: validated.errors.join("; ") },
      { status: 400 }
    );
  }

  try {
    await upsertBroadcastScheduleState(validated.state);
  } catch (e) {
    const msg = e instanceof Error ? e.message.slice(0, 200) : "persist_failed";
    broadcastAudit("broadcast_schedule_invalid", {
      broadcastSessionId,
      userId,
      reason: `persist:${msg}`,
    });
    incrementBroadcastScheduleError({ userId, sessionId: broadcastSessionId, reason: "persist" });
    return NextResponse.json(
      { ok: false, code: BROADCAST_CODES.scheduleInvalid, error: "Could not save schedule state" },
      { status: 503 }
    );
  }

  broadcastAudit("broadcast_schedule_changed", {
    broadcastSessionId,
    userId,
    automationEnabled: validated.state.automationEnabled,
    actionCount: validated.state.actions.length,
  });
  incrementBroadcastScheduleChange({ userId, sessionId: broadcastSessionId, roomId: auth.session.roomId });

  if (patch.countdown !== undefined) {
    const wasVisible = base.countdown.visible;
    const nowVisible = validated.state.countdown.visible;
    if (!wasVisible && nowVisible) {
      publishBroadcastTimelineEventSafe({
        broadcastSessionId,
        userId,
        eventType: "countdown_started",
        summary: "Countdown shown",
        detailsJson: {
          targetTimeIso: validated.state.countdown.targetTimeIso ?? null,
          position: validated.state.countdown.position,
        },
      });
    } else if (wasVisible && !nowVisible) {
      publishBroadcastTimelineEventSafe({
        broadcastSessionId,
        userId,
        eventType: "countdown_stopped",
        summary: "Countdown hidden",
        detailsJson: {},
      });
    }
  }

  publishScheduleUpdated(broadcastSessionId, auth.session.roomId);
  if (patch.countdown !== undefined) {
    publishCountdownUpdated(broadcastSessionId, auth.session.roomId);
  }

  const nowIso = new Date().toISOString();
  const summary = buildScheduleSummaryForStatus(validated.state, nowIso);

  return NextResponse.json({ ok: true, state: validated.state, summary });
}
