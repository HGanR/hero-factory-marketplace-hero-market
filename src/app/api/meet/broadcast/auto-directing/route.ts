import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getAuthedUserId } from "@/lib/api/auth";
import { getDb } from "@/lib/db";
import { meetBroadcastSessions } from "@/lib/db/schema";
import { assertMeetBroadcastHost } from "@/lib/meet/broadcast-host";
import { BROADCAST_CODES } from "@/lib/meet/broadcast-codes";
import { BROADCAST_LIVE_STATUSES } from "@/lib/meet/broadcast-constants";
import { broadcastAudit } from "@/lib/meet/broadcast-audit";
import { isManualAutoDirectingOverrideActive, validateBroadcastAutoDirectingPolicy } from "@/lib/meet/broadcast-auto-directing";
import {
  applyBroadcastAutoDirectingRecommendationManual,
  evaluateBroadcastAutoDirectingForSession,
  type SessionRow,
} from "@/lib/meet/broadcast-auto-directing-engine";
import {
  buildAutoDirectingPublicSummary,
  ensureBroadcastAutoDirectingStateForSession,
  getBroadcastAutoDirectingState,
  upsertBroadcastAutoDirectingState,
} from "@/lib/meet/broadcast-auto-directing-store";
import { incrementBroadcastAutoDirectingChange } from "@/lib/meet/broadcast-metrics";
import { isV2LiveSceneControlAvailable } from "@/lib/meet/broadcast-live-scenes";
import { publishAutoDirectingUpdated } from "@/lib/meet/broadcast-event-publisher";

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
      code: BROADCAST_CODES.autoDirectingSessionNotFound,
      message: "Broadcast session not found",
    };
  }
  if (session.userId !== userId) {
    return {
      ok: false,
      status: 403,
      code: BROADCAST_CODES.autoDirectingHostMismatch,
      message: "Not allowed for this session",
    };
  }
  if (!BROADCAST_LIVE_STATUSES.includes(session.status as (typeof BROADCAST_LIVE_STATUSES)[number])) {
    return {
      ok: false,
      status: 409,
      code: BROADCAST_CODES.autoDirectingNotActive,
      message: "Broadcast is not active",
    };
  }
  if (!isV2LiveSceneControlAvailable(session)) {
    return {
      ok: false,
      status: 409,
      code: BROADCAST_CODES.autoDirectingNotSupported,
      message: "Auto-directing requires an active V2 rendered compositor session",
    };
  }
  return { ok: true, session };
}

function asSessionRow(session: typeof meetBroadcastSessions.$inferSelect): SessionRow {
  return session as SessionRow;
}

/**
 * GET /api/meet/broadcast/auto-directing?broadcastSessionId=&hostWallet=
 */
export async function GET(req: NextRequest) {
  const userId = await getAuthedUserId();
  if (userId == null) {
    return NextResponse.json(
      { ok: false, code: BROADCAST_CODES.notAuthenticated, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const broadcastSessionId = Number(req.nextUrl.searchParams.get("broadcastSessionId")?.trim() ?? "");
  if (!Number.isFinite(broadcastSessionId) || broadcastSessionId <= 0) {
    return NextResponse.json(
      { ok: false, code: BROADCAST_CODES.autoDirectingInvalid, error: "Invalid broadcastSessionId" },
      { status: 400 }
    );
  }

  const host = await assertMeetBroadcastHost(userId, req.nextUrl.searchParams.get("hostWallet"));
  if (!host.ok) {
    return NextResponse.json({ ok: false, code: host.code, error: host.error }, { status: host.status });
  }

  const auth = await loadAuthorizedSession(userId, broadcastSessionId);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, code: auth.code, error: auth.message }, { status: auth.status });
  }

  const nowIso = new Date().toISOString();
  await evaluateBroadcastAutoDirectingForSession(broadcastSessionId, asSessionRow(auth.session), nowIso);
  const ad = await getBroadcastAutoDirectingState(broadcastSessionId);
  const eff = ad ?? (await ensureBroadcastAutoDirectingStateForSession(broadcastSessionId, userId));

  return NextResponse.json({
    ok: true,
    summary: buildAutoDirectingPublicSummary(eff, nowIso),
    policy: eff.policy,
    lastDecision: eff.lastDecision,
    manualOverrideUntilIso: eff.manualOverrideUntilIso,
    manualOverrideActive: isManualAutoDirectingOverrideActive(eff.manualOverrideUntilIso, nowIso),
    lastAppliedAt: eff.lastAppliedAt,
  });
}

type PostBody = {
  broadcastSessionId?: number | string;
  hostWallet?: string | null;
  policy?: Record<string, unknown>;
  mode?: string;
  manualOverrideUntilIso?: string | null;
  applyRecommendedNow?: boolean;
};

/**
 * POST /api/meet/broadcast/auto-directing
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
    return NextResponse.json(
      { ok: false, code: BROADCAST_CODES.autoDirectingInvalid, error: "Invalid JSON" },
      { status: 400 }
    );
  }

  const sid = typeof body.broadcastSessionId === "string" ? Number(body.broadcastSessionId) : body.broadcastSessionId;
  if (!Number.isFinite(sid) || !sid) {
    return NextResponse.json(
      { ok: false, code: BROADCAST_CODES.autoDirectingInvalid, error: "broadcastSessionId required" },
      { status: 400 }
    );
  }

  const host = await assertMeetBroadcastHost(userId, body.hostWallet ?? null);
  if (!host.ok) {
    return NextResponse.json({ ok: false, code: host.code, error: host.error }, { status: host.status });
  }

  const auth = await loadAuthorizedSession(userId, sid);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, code: auth.code, error: auth.message }, { status: auth.status });
  }

  const nowIso = new Date().toISOString();
  let ad = await ensureBroadcastAutoDirectingStateForSession(sid, userId);
  let changed = false;

  if (body.policy != null || body.mode != null) {
    const merged = {
      ...ad.policy,
      ...(body.policy ?? {}),
      ...(body.mode != null ? { mode: body.mode } : {}),
    };
    const v = validateBroadcastAutoDirectingPolicy(merged);
    if (!v.ok) {
      broadcastAudit("broadcast_auto_directing_invalid", {
        broadcastSessionId: sid,
        userId,
        reason: v.errors.join("|").slice(0, 200),
      });
      return NextResponse.json(
        { ok: false, code: BROADCAST_CODES.autoDirectingInvalid, error: v.errors.join("; ") },
        { status: 400 }
      );
    }
    ad = { ...ad, policy: v.policy, updatedByUserId: userId };
    changed = true;
  }

  if (body.manualOverrideUntilIso !== undefined) {
    ad = {
      ...ad,
      manualOverrideUntilIso:
        body.manualOverrideUntilIso === null || body.manualOverrideUntilIso === ""
          ? null
          : String(body.manualOverrideUntilIso).trim(),
      updatedByUserId: userId,
    };
    changed = true;
  }

  if (changed) {
    await upsertBroadcastAutoDirectingState({ broadcastSessionId: sid, userId, state: ad });
    incrementBroadcastAutoDirectingChange({ userId, sessionId: sid, roomId: auth.session.roomId, reason: "policy" });
    broadcastAudit("broadcast_auto_directing_changed", {
      broadcastSessionId: sid,
      userId,
      roomId: auth.session.roomId,
      mode: ad.policy.mode,
    });
    publishAutoDirectingUpdated(sid, auth.session.roomId, { settings: true });
  }

  await evaluateBroadcastAutoDirectingForSession(sid, asSessionRow(auth.session), nowIso);

  if (body.applyRecommendedNow) {
    const r = await applyBroadcastAutoDirectingRecommendationManual(sid, asSessionRow(auth.session), nowIso);
    if (!r.ok) {
      broadcastAudit("broadcast_auto_directing_denied", {
        broadcastSessionId: sid,
        userId,
        reason: r.error,
      });
      return NextResponse.json(
        { ok: false, code: BROADCAST_CODES.autoDirectingInvalid, error: "Could not apply recommendation" },
        { status: 400 }
      );
    }
  }

  const next = (await getBroadcastAutoDirectingState(sid)) ?? ad;
  return NextResponse.json({
    ok: true,
    summary: buildAutoDirectingPublicSummary(next, nowIso),
    policy: next.policy,
    lastDecision: next.lastDecision,
    manualOverrideUntilIso: next.manualOverrideUntilIso,
    manualOverrideActive: isManualAutoDirectingOverrideActive(next.manualOverrideUntilIso, nowIso),
    lastAppliedAt: next.lastAppliedAt,
  });
}
