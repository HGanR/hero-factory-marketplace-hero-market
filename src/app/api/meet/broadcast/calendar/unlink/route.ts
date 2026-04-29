import { NextRequest, NextResponse } from "next/server";
import { getAuthedUserId } from "@/lib/api/auth";
import { assertMeetBroadcastHost } from "@/lib/meet/broadcast-host";
import { BROADCAST_CODES } from "@/lib/meet/broadcast-codes";
import { broadcastAudit } from "@/lib/meet/broadcast-audit";
import { incrementBroadcastCalendarLinkDelete } from "@/lib/meet/broadcast-metrics";
import { deleteBroadcastCalendarLink } from "@/lib/meet/broadcast-calendar-link-store";

/**
 * POST /api/meet/broadcast/calendar/unlink
 * Body: { broadcastEventId, hostWallet? } — removes link row only; broadcast event unchanged.
 */
export async function POST(req: NextRequest) {
  const userId = await getAuthedUserId();
  if (userId == null) {
    return NextResponse.json(
      { ok: false, code: BROADCAST_CODES.notAuthenticated, error: "Unauthorized" },
      { status: 401 }
    );
  }
  let body: { broadcastEventId?: unknown; hostWallet?: string | null };
  try {
    body = (await req.json()) as { broadcastEventId?: unknown; hostWallet?: string | null };
  } catch {
    return NextResponse.json(
      { ok: false, code: BROADCAST_CODES.broadcastCalendarLinkInvalid, error: "Invalid JSON" },
      { status: 400 }
    );
  }
  const sid = Number(body.broadcastEventId);
  if (!Number.isFinite(sid) || sid <= 0) {
    return NextResponse.json(
      { ok: false, code: BROADCAST_CODES.broadcastCalendarLinkInvalid, error: "broadcastEventId required" },
      { status: 400 }
    );
  }
  const host = await assertMeetBroadcastHost(userId, body.hostWallet ?? null);
  if (!host.ok) {
    return NextResponse.json({ ok: false, code: host.code, error: host.error }, { status: host.status });
  }

  const ok = await deleteBroadcastCalendarLink(sid, userId);
  if (!ok) {
    return NextResponse.json(
      { ok: false, code: BROADCAST_CODES.broadcastCalendarLinkNotFound, error: "No calendar link for this event" },
      { status: 404 }
    );
  }
  incrementBroadcastCalendarLinkDelete({ userId, sessionId: null, roomId: null });
  broadcastAudit("broadcast_calendar_link_deleted", { userId, broadcastEventId: sid });
  return NextResponse.json({ ok: true });
}
