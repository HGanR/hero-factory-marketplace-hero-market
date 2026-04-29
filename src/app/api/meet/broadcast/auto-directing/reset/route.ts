import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getAuthedUserId } from "@/lib/api/auth";
import { getDb } from "@/lib/db";
import { meetBroadcastSessions } from "@/lib/db/schema";
import { assertMeetBroadcastHost } from "@/lib/meet/broadcast-host";
import { BROADCAST_CODES } from "@/lib/meet/broadcast-codes";
import { BROADCAST_LIVE_STATUSES } from "@/lib/meet/broadcast-constants";
import { broadcastAudit } from "@/lib/meet/broadcast-audit";
import { resetBroadcastAutoDirectingState } from "@/lib/meet/broadcast-auto-directing-store";
import { incrementBroadcastAutoDirectingChange } from "@/lib/meet/broadcast-metrics";
import { isV2LiveSceneControlAvailable } from "@/lib/meet/broadcast-live-scenes";
import { publishAutoDirectingUpdated } from "@/lib/meet/broadcast-event-publisher";

/**
 * POST /api/meet/broadcast/auto-directing/reset
 * Body: { broadcastSessionId, hostWallet? } — removes persisted auto-directing row (back to defaults on next read).
 */
export async function POST(req: NextRequest) {
  const userId = await getAuthedUserId();
  if (userId == null) {
    return NextResponse.json(
      { ok: false, code: BROADCAST_CODES.notAuthenticated, error: "Unauthorized" },
      { status: 401 }
    );
  }

  let body: { broadcastSessionId?: number | string; hostWallet?: string | null };
  try {
    body = (await req.json()) as { broadcastSessionId?: number | string; hostWallet?: string | null };
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

  const db = await getDb();
  const rows = await db.select().from(meetBroadcastSessions).where(eq(meetBroadcastSessions.id, sid)).limit(1);
  const session = rows[0];
  if (!session) {
    return NextResponse.json(
      { ok: false, code: BROADCAST_CODES.autoDirectingSessionNotFound, error: "Not found" },
      { status: 404 }
    );
  }
  if (session.userId !== userId) {
    return NextResponse.json(
      { ok: false, code: BROADCAST_CODES.autoDirectingHostMismatch, error: "Not allowed" },
      { status: 403 }
    );
  }
  if (!BROADCAST_LIVE_STATUSES.includes(session.status as (typeof BROADCAST_LIVE_STATUSES)[number])) {
    return NextResponse.json(
      { ok: false, code: BROADCAST_CODES.autoDirectingNotActive, error: "Not active" },
      { status: 409 }
    );
  }
  if (!isV2LiveSceneControlAvailable(session)) {
    return NextResponse.json(
      { ok: false, code: BROADCAST_CODES.autoDirectingNotSupported, error: "Not supported" },
      { status: 409 }
    );
  }

  await resetBroadcastAutoDirectingState(sid, userId);
  incrementBroadcastAutoDirectingChange({ userId, sessionId: sid, roomId: session.roomId, reason: "reset" });
  broadcastAudit("broadcast_auto_directing_changed", {
    broadcastSessionId: sid,
    userId,
    roomId: session.roomId,
    action: "reset",
  });
  publishAutoDirectingUpdated(sid, session.roomId, { reset: true });

  return NextResponse.json({ ok: true });
}
