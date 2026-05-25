import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getAuthedUserId } from "@/lib/api/auth";
import { getDb } from "@/lib/db";
import { meetBroadcastSessions } from "@/lib/db/schema";
import { assertMeetBroadcastHost } from "@/lib/meet/broadcast-host";
import { BROADCAST_CODES } from "@/lib/meet/broadcast-codes";
import { BROADCAST_LIVE_STATUSES } from "@/lib/meet/broadcast-constants";
import { broadcastAudit } from "@/lib/meet/broadcast-audit";
import { incrementBroadcastOverlayChange, incrementBroadcastOverlayError } from "@/lib/meet/broadcast-metrics";
import { isV2LiveSceneControlAvailable } from "@/lib/meet/broadcast-live-scenes";
import type { BroadcastOverlayPatch } from "@/lib/meet/broadcast-overlays";
import {
  getDefaultOverlayState,
  mergeBroadcastOverlayPatch,
  validateBroadcastOverlayState,
} from "@/lib/meet/broadcast-overlays";
import { getBroadcastOverlayState, upsertBroadcastOverlayState } from "@/lib/meet/broadcast-overlay-store";
import { getBroadcastOverlayPackById, recordBroadcastOverlayPackApplied } from "@/lib/meet/broadcast-overlay-pack-store";
import { buildOverlayPatchFromPack } from "@/lib/meet/broadcast-overlay-packs";
import { getBroadcastGuestCardPackById, recordBroadcastGuestCardApplied } from "@/lib/meet/broadcast-guest-card-pack-store";
import { buildLowerThirdFromGuestCard } from "@/lib/meet/broadcast-guest-cards";
import { evaluateBroadcastScheduleForActiveSession } from "@/lib/meet/broadcast-scheduler";
import { publishOverlaysUpdated } from "@/lib/meet/broadcast-event-publisher";
import { publishBroadcastTimelineEventSafe } from "@/lib/meet/broadcast-timeline-publisher";

type PostBody = {
  broadcastSessionId?: number | string;
  hostWallet?: string | null;
  /** Explicit apply: merge pack JSON into current state before optional field patches. */
  applyOverlayPackId?: number | string;
  guestCardPackId?: number | string;
  guestCardId?: string;
} & BroadcastOverlayPatch;

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
    return { ok: false, status: 404, code: BROADCAST_CODES.overlaySessionNotFound, message: "Broadcast session not found" };
  }
  if (session.userId !== userId) {
    broadcastAudit("broadcast_overlay_denied", {
      broadcastSessionId,
      userId,
      reason: "owner_mismatch",
    });
    incrementBroadcastOverlayError({ userId, sessionId: broadcastSessionId, reason: "owner_mismatch" });
    return { ok: false, status: 403, code: BROADCAST_CODES.overlayHostMismatch, message: "Not allowed for this session" };
  }
  if (!BROADCAST_LIVE_STATUSES.includes(session.status as (typeof BROADCAST_LIVE_STATUSES)[number])) {
    return { ok: false, status: 409, code: BROADCAST_CODES.overlayNotActive, message: "Broadcast is not active" };
  }
  if (!isV2LiveSceneControlAvailable(session)) {
    return {
      ok: false,
      status: 409,
      code: BROADCAST_CODES.overlayNotSupported,
      message: "Overlays require an active V2 rendered compositor session",
    };
  }
  return { ok: true, session };
}

/**
 * GET /api/meet/broadcast/overlays?broadcastSessionId=&hostWallet=
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
      { ok: false, code: BROADCAST_CODES.overlayInvalid, error: "Invalid broadcastSessionId" },
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

  await evaluateBroadcastScheduleForActiveSession(auth.session, new Date().toISOString());

  const persisted = await getBroadcastOverlayState(broadcastSessionId);
  const state = persisted ?? getDefaultOverlayState(broadcastSessionId, userId);
  return NextResponse.json({ ok: true, state, persisted: Boolean(persisted) });
}

/**
 * POST /api/meet/broadcast/overlays
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
    broadcastAudit("broadcast_overlay_invalid", { userId, reason: "bad_json" });
    incrementBroadcastOverlayError({ userId, sessionId: null, reason: "bad_json" });
    return NextResponse.json(
      { ok: false, code: BROADCAST_CODES.overlayInvalid, error: "Invalid JSON" },
      { status: 400 }
    );
  }

  const sid = body.broadcastSessionId;
  const broadcastSessionIdNum =
    typeof sid === "string" ? Number(sid.trim()) : typeof sid === "number" ? sid : Number.NaN;
  if (!Number.isFinite(broadcastSessionIdNum) || broadcastSessionIdNum <= 0) {
    broadcastAudit("broadcast_overlay_invalid", { userId, reason: "bad_session_id" });
    incrementBroadcastOverlayError({ userId, sessionId: null, reason: "bad_session_id" });
    return NextResponse.json(
      { ok: false, code: BROADCAST_CODES.overlayInvalid, error: "broadcastSessionId is required" },
      { status: 400 }
    );
  }
  const broadcastSessionId = broadcastSessionIdNum;

  const host = await assertMeetBroadcastHost(userId, body.hostWallet ?? null);
  if (!host.ok) {
    broadcastAudit("broadcast_overlay_denied", { broadcastSessionId, userId, reason: "host_wallet" });
    incrementBroadcastOverlayError({ userId, sessionId: broadcastSessionId, reason: "host_wallet" });
    return NextResponse.json({ ok: false, code: host.code, error: host.error }, { status: host.status });
  }

  const auth = await loadAuthorizedSession(userId, broadcastSessionId);
  if (!auth.ok) {
    if (auth.code === BROADCAST_CODES.overlaySessionNotFound) {
      broadcastAudit("broadcast_overlay_denied", { broadcastSessionId, userId, reason: "session_not_found" });
    }
    if (auth.code === BROADCAST_CODES.overlayNotActive) {
      broadcastAudit("broadcast_overlay_denied", { broadcastSessionId, userId, reason: "not_active" });
    }
    if (auth.code === BROADCAST_CODES.overlayNotSupported) {
      broadcastAudit("broadcast_overlay_denied", { broadcastSessionId, userId, reason: "v2_required" });
    }
    incrementBroadcastOverlayError({ userId, sessionId: broadcastSessionId, reason: auth.code });
    return NextResponse.json(
      { ok: false, code: auth.code, error: auth.message },
      { status: auth.status }
    );
  }

  const persisted = await getBroadcastOverlayState(broadcastSessionId);
  let working = persisted ?? getDefaultOverlayState(broadcastSessionId, userId);

  const applyPackRaw = body.applyOverlayPackId;
  const applyPackId = typeof applyPackRaw === "string" ? Number(applyPackRaw) : applyPackRaw;
  if (applyPackRaw !== undefined && applyPackRaw !== null) {
    if (!Number.isFinite(applyPackId) || (applyPackId as number) <= 0) {
      incrementBroadcastOverlayError({ userId, sessionId: broadcastSessionId, reason: "bad_overlay_pack_id" });
      return NextResponse.json(
        { ok: false, code: BROADCAST_CODES.overlayInvalid, error: "Invalid applyOverlayPackId" },
        { status: 400 }
      );
    }
    const opack = await getBroadcastOverlayPackById(applyPackId as number, userId);
    if (!opack) {
      incrementBroadcastOverlayError({ userId, sessionId: broadcastSessionId, reason: "overlay_pack_not_found" });
      return NextResponse.json(
        { ok: false, code: BROADCAST_CODES.overlayInvalid, error: "Overlay pack not found" },
        { status: 400 }
      );
    }
    const packPatch = buildOverlayPatchFromPack(opack);
    working = mergeBroadcastOverlayPatch(working, packPatch);
    recordBroadcastOverlayPackApplied(userId, opack.id);
  }

  const gPackRaw = body.guestCardPackId;
  const gPackId = typeof gPackRaw === "string" ? Number(gPackRaw) : gPackRaw;
  const gCardId = typeof body.guestCardId === "string" ? body.guestCardId.trim() : "";
  if (gPackRaw !== undefined && gPackRaw !== null) {
    if (!Number.isFinite(gPackId) || (gPackId as number) <= 0 || !gCardId) {
      incrementBroadcastOverlayError({ userId, sessionId: broadcastSessionId, reason: "bad_guest_card_ref" });
      return NextResponse.json(
        { ok: false, code: BROADCAST_CODES.overlayInvalid, error: "guestCardPackId and guestCardId required together" },
        { status: 400 }
      );
    }
    const gpack = await getBroadcastGuestCardPackById(gPackId as number, userId);
    if (!gpack) {
      incrementBroadcastOverlayError({ userId, sessionId: broadcastSessionId, reason: "guest_pack_not_found" });
      return NextResponse.json(
        { ok: false, code: BROADCAST_CODES.overlayInvalid, error: "Guest card pack not found" },
        { status: 400 }
      );
    }
    const card = gpack.guestCardsJson.cards.find((c) => c.id === gCardId);
    if (!card) {
      incrementBroadcastOverlayError({ userId, sessionId: broadcastSessionId, reason: "guest_card_not_found" });
      return NextResponse.json(
        { ok: false, code: BROADCAST_CODES.overlayInvalid, error: "Guest card not found in pack" },
        { status: 400 }
      );
    }
    const lt = buildLowerThirdFromGuestCard(card, working.lowerThird);
    working = mergeBroadcastOverlayPatch(working, { lowerThird: lt });
    recordBroadcastGuestCardApplied(userId, card.id);
  }

  const patch: BroadcastOverlayPatch = {
    lowerThird: body.lowerThird,
    ticker: body.ticker,
    ctaBanner: body.ctaBanner,
  };

  const merged = mergeBroadcastOverlayPatch(working, patch);
  const now = new Date().toISOString();
  const nextState = { ...merged, updatedAt: now, updatedByUserId: userId, broadcastSessionId };
  const validated = validateBroadcastOverlayState(nextState);
  if (!validated.ok) {
    broadcastAudit("broadcast_overlay_invalid", {
      broadcastSessionId,
      userId,
      reason: validated.errors.join("|").slice(0, 300),
    });
    incrementBroadcastOverlayError({
      userId,
      sessionId: broadcastSessionId,
      reason: "validation",
    });
    return NextResponse.json(
      { ok: false, code: BROADCAST_CODES.overlayInvalid, error: validated.errors.join("; ") },
      { status: 400 }
    );
  }

  try {
    await upsertBroadcastOverlayState(validated.state);
  } catch (e) {
    const msg = e instanceof Error ? e.message.slice(0, 200) : "persist_failed";
    broadcastAudit("broadcast_overlay_invalid", {
      broadcastSessionId,
      userId,
      reason: `persist:${msg}`,
    });
    incrementBroadcastOverlayError({ userId, sessionId: broadcastSessionId, reason: "persist" });
    return NextResponse.json(
      { ok: false, code: BROADCAST_CODES.overlayInvalid, error: "Could not save overlay state" },
      { status: 503 }
    );
  }

  broadcastAudit("broadcast_overlay_changed", {
    broadcastSessionId,
    userId,
    lowerThirdVisible: validated.state.lowerThird.visible,
    tickerVisible: validated.state.ticker.visible,
    ctaVisible: validated.state.ctaBanner.visible,
  });
  incrementBroadcastOverlayChange({ userId, sessionId: broadcastSessionId, roomId: auth.session.roomId });

  publishOverlaysUpdated(broadcastSessionId, auth.session.roomId);

  publishBroadcastTimelineEventSafe({
    broadcastSessionId,
    userId,
    eventType: "overlay_changed",
    summary: "Overlay visibility updated",
    detailsJson: {
      lowerThirdVisible: validated.state.lowerThird.visible,
      tickerVisible: validated.state.ticker.visible,
      ctaBannerVisible: validated.state.ctaBanner.visible,
      ...(Number.isFinite(applyPackId as number) && applyPackRaw != null
        ? { appliedOverlayPackId: applyPackId as number }
        : {}),
      ...(gCardId && gPackRaw != null ? { appliedGuestCardId: gCardId.slice(0, 120) } : {}),
    },
  });

  return NextResponse.json({ ok: true, state: validated.state });
}
