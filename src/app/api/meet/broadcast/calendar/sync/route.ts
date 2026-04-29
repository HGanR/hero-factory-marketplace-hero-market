import { NextRequest, NextResponse } from "next/server";
import { getAuthedUserId } from "@/lib/api/auth";
import { assertMeetBroadcastHost } from "@/lib/meet/broadcast-host";
import { BROADCAST_CODES } from "@/lib/meet/broadcast-codes";
import { broadcastAudit } from "@/lib/meet/broadcast-audit";
import { incrementBroadcastCalendarSync, incrementBroadcastCalendarSyncError } from "@/lib/meet/broadcast-metrics";
import { getBroadcastCalendarLinkByBroadcastEventId } from "@/lib/meet/broadcast-calendar-link-store";
import { pullExternalIntoBroadcastEvent } from "@/lib/meet/broadcast-calendar-ops";

/**
 * POST /api/meet/broadcast/calendar/sync
 * Body: { broadcastEventId, hostWallet? } — explicit pull from external into broadcast metadata fields.
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
  const eid = Number(body.broadcastEventId);
  if (!Number.isFinite(eid) || eid <= 0) {
    return NextResponse.json(
      { ok: false, code: BROADCAST_CODES.broadcastCalendarLinkInvalid, error: "broadcastEventId required" },
      { status: 400 }
    );
  }
  const host = await assertMeetBroadcastHost(userId, body.hostWallet ?? null);
  if (!host.ok) {
    return NextResponse.json({ ok: false, code: host.code, error: host.error }, { status: host.status });
  }

  const link = await getBroadcastCalendarLinkByBroadcastEventId(eid, userId);
  if (!link) {
    return NextResponse.json(
      { ok: false, code: BROADCAST_CODES.broadcastCalendarLinkNotFound, error: "No calendar link" },
      { status: 404 }
    );
  }

  const r = await pullExternalIntoBroadcastEvent(userId, eid, link);
  if (!r.ok) {
    incrementBroadcastCalendarSyncError({ userId, sessionId: null, roomId: null, reason: r.error.slice(0, 120) });
    broadcastAudit("broadcast_calendar_sync_failed", {
      userId,
      broadcastEventId: eid,
      errorSummary: r.error.slice(0, 200),
    });
    const isConfig = r.error === "google_not_configured";
    return NextResponse.json(
      {
        ok: false,
        code: isConfig ? BROADCAST_CODES.broadcastCalendarNotConfigured : BROADCAST_CODES.broadcastCalendarExternalError,
        error: r.error,
      },
      { status: isConfig ? 400 : 502 }
    );
  }

  incrementBroadcastCalendarSync({ userId, sessionId: null, roomId: null });
  broadcastAudit("broadcast_calendar_synced", { userId, broadcastEventId: eid, provider: link.provider });
  return NextResponse.json({ ok: true });
}
