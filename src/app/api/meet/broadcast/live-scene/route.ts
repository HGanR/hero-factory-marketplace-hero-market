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
  incrementBroadcastLiveSceneChange,
  incrementBroadcastLiveSceneError,
} from "@/lib/meet/broadcast-metrics";
import {
  getDefaultLiveSceneStateFromSession,
  isV2LiveSceneControlAvailable,
  mergeLiveScenePatch,
  validateLiveSceneState,
  type LiveScenePatch,
} from "@/lib/meet/broadcast-live-scenes";
import {
  getBroadcastLiveSceneState,
  upsertBroadcastLiveSceneState,
} from "@/lib/meet/broadcast-live-scene-store";
import { evaluateBroadcastScheduleForActiveSession } from "@/lib/meet/broadcast-scheduler";
import { publishLiveSceneUpdated } from "@/lib/meet/broadcast-event-publisher";
import { evaluateBroadcastAutoDirectingForActiveSession, type SessionRow } from "@/lib/meet/broadcast-auto-directing-engine";
import { recordOperatorManualLayoutOverride } from "@/lib/meet/broadcast-auto-directing-override";
import { publishBroadcastTimelineEventSafe } from "@/lib/meet/broadcast-timeline-publisher";

type PostBody = {
  broadcastSessionId?: number | string;
  hostWallet?: string | null;
} & LiveScenePatch;

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
    return { ok: false, status: 404, code: BROADCAST_CODES.liveSceneSessionNotFound, message: "Broadcast session not found" };
  }
  if (session.userId !== userId) {
    broadcastAudit("broadcast_live_scene_denied", {
      broadcastSessionId,
      userId,
      reason: "owner_mismatch",
    });
    incrementBroadcastLiveSceneError({ userId, sessionId: broadcastSessionId, reason: "owner_mismatch" });
    return { ok: false, status: 403, code: BROADCAST_CODES.liveSceneHostMismatch, message: "Not allowed for this session" };
  }
  if (!BROADCAST_LIVE_STATUSES.includes(session.status as (typeof BROADCAST_LIVE_STATUSES)[number])) {
    return { ok: false, status: 409, code: BROADCAST_CODES.liveSceneNotActive, message: "Broadcast is not active" };
  }
  if (!isV2LiveSceneControlAvailable(session)) {
    return {
      ok: false,
      status: 409,
      code: BROADCAST_CODES.liveSceneNotSupported,
      message: "Live scene control requires an active V2 rendered compositor session",
    };
  }
  return { ok: true, session };
}

/**
 * GET /api/meet/broadcast/live-scene?broadcastSessionId=&hostWallet=
 * Returns effective live scene state (persisted or program default). Does not write DB.
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
      { ok: false, code: BROADCAST_CODES.liveSceneInvalid, error: "Invalid broadcastSessionId" },
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
  await evaluateBroadcastScheduleForActiveSession(auth.session, nowIso);
  await evaluateBroadcastAutoDirectingForActiveSession(auth.session as SessionRow, nowIso);

  const persisted = await getBroadcastLiveSceneState(broadcastSessionId);
  const state = persisted ?? getDefaultLiveSceneStateFromSession(auth.session, userId);
  return NextResponse.json({ ok: true, state, persisted: Boolean(persisted) });
}

/**
 * POST /api/meet/broadcast/live-scene
 * Body: broadcastSessionId, optional hostWallet, optional partial scene patch.
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
    broadcastAudit("broadcast_live_scene_invalid", { userId, reason: "bad_json" });
    incrementBroadcastLiveSceneError({ userId, sessionId: null, reason: "bad_json" });
    return NextResponse.json(
      { ok: false, code: BROADCAST_CODES.liveSceneInvalid, error: "Invalid JSON" },
      { status: 400 }
    );
  }

  const sid = body.broadcastSessionId;
  const broadcastSessionId = typeof sid === "string" ? Number(sid) : sid;
  if (!Number.isFinite(broadcastSessionId) || broadcastSessionId <= 0) {
    broadcastAudit("broadcast_live_scene_invalid", { userId, reason: "bad_session_id" });
    incrementBroadcastLiveSceneError({ userId, sessionId: null, reason: "bad_session_id" });
    return NextResponse.json(
      { ok: false, code: BROADCAST_CODES.liveSceneInvalid, error: "broadcastSessionId is required" },
      { status: 400 }
    );
  }

  const host = await assertMeetBroadcastHost(userId, body.hostWallet ?? null);
  if (!host.ok) {
    broadcastAudit("broadcast_live_scene_denied", { broadcastSessionId, userId, reason: "host_wallet" });
    incrementBroadcastLiveSceneError({ userId, sessionId: broadcastSessionId, reason: "host_wallet" });
    return NextResponse.json({ ok: false, code: host.code, error: host.error }, { status: host.status });
  }

  const auth = await loadAuthorizedSession(userId, broadcastSessionId);
  if (!auth.ok) {
    if (auth.code === BROADCAST_CODES.liveSceneHostMismatch) {
      return NextResponse.json(
        { ok: false, code: auth.code, error: auth.message },
        { status: auth.status }
      );
    }
    if (auth.code === BROADCAST_CODES.liveSceneSessionNotFound) {
      broadcastAudit("broadcast_live_scene_denied", { broadcastSessionId, userId, reason: "session_not_found" });
    }
    if (auth.code === BROADCAST_CODES.liveSceneNotActive) {
      broadcastAudit("broadcast_live_scene_denied", { broadcastSessionId, userId, reason: "not_active" });
    }
    if (auth.code === BROADCAST_CODES.liveSceneNotSupported) {
      broadcastAudit("broadcast_live_scene_denied", { broadcastSessionId, userId, reason: "v2_required" });
    }
    incrementBroadcastLiveSceneError({ userId, sessionId: broadcastSessionId, reason: auth.code });
    return NextResponse.json(
      { ok: false, code: auth.code, error: auth.message },
      { status: auth.status }
    );
  }

  const persisted = await getBroadcastLiveSceneState(broadcastSessionId);
  const base = persisted ?? getDefaultLiveSceneStateFromSession(auth.session, userId);

  const patch: LiveScenePatch = {
    sceneType: body.sceneType,
    layoutMode: body.layoutMode,
    branding: body.branding,
    showParticipantNames: body.showParticipantNames,
    showMutedIndicators: body.showMutedIndicators,
    showFooter: body.showFooter,
    portraitSafe: body.portraitSafe,
    screenSharePriority: body.screenSharePriority,
    customHeadline: body.customHeadline,
    customSubheadline: body.customSubheadline,
  };

  const merged = mergeLiveScenePatch(base, patch);
  const now = new Date().toISOString();
  const nextState = { ...merged, updatedAt: now, updatedByUserId: userId, broadcastSessionId };
  const validated = validateLiveSceneState(nextState);
  if (!validated.ok) {
    broadcastAudit("broadcast_live_scene_invalid", {
      broadcastSessionId,
      userId,
      reason: validated.errors.join("|").slice(0, 300),
    });
    incrementBroadcastLiveSceneError({
      userId,
      sessionId: broadcastSessionId,
      reason: "validation",
    });
    return NextResponse.json(
      { ok: false, code: BROADCAST_CODES.liveSceneInvalid, error: validated.errors.join("; ") },
      { status: 400 }
    );
  }

  try {
    await upsertBroadcastLiveSceneState(validated.state);
    if (patch.layoutMode !== undefined) {
      void recordOperatorManualLayoutOverride(broadcastSessionId, userId, auth.session.roomId);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message.slice(0, 200) : "persist_failed";
    broadcastAudit("broadcast_live_scene_invalid", {
      broadcastSessionId,
      userId,
      reason: `persist:${msg}`,
    });
    incrementBroadcastLiveSceneError({ userId, sessionId: broadcastSessionId, reason: "persist" });
    return NextResponse.json(
      { ok: false, code: BROADCAST_CODES.liveSceneInvalid, error: "Could not save live scene state" },
      { status: 503 }
    );
  }

  broadcastAudit("broadcast_live_scene_changed", {
    broadcastSessionId,
    userId,
    sceneType: validated.state.sceneType,
    layoutMode: validated.state.layoutMode,
  });
  incrementBroadcastLiveSceneChange({ userId, sessionId: broadcastSessionId, roomId: auth.session.roomId });

  publishLiveSceneUpdated(broadcastSessionId, auth.session.roomId);

  publishBroadcastTimelineEventSafe({
    broadcastSessionId,
    userId,
    eventType: "live_scene_changed",
    summary: `Scene ${validated.state.sceneType} / ${validated.state.layoutMode}`,
    detailsJson: {
      sceneType: validated.state.sceneType,
      layoutMode: validated.state.layoutMode,
    },
  });

  return NextResponse.json({ ok: true, state: validated.state });
}
