import { NextRequest, NextResponse } from "next/server";
import { getAuthedUserId } from "@/lib/api/auth";
import { assertMeetBroadcastHost } from "@/lib/meet/broadcast-host";
import { BROADCAST_CODES } from "@/lib/meet/broadcast-codes";
import {
  assertTimelineSessionOwned,
  buildBroadcastTimelineSummary,
  listBroadcastTimelineEvents,
} from "@/lib/meet/broadcast-timeline-store";

/**
 * GET /api/meet/broadcast/timeline?broadcastSessionId=&hostWallet=&limit=
 * Ordered timeline + aggregate summary for a session (owner only).
 */
export async function GET(req: NextRequest) {
  const userId = await getAuthedUserId();
  if (userId == null) {
    return NextResponse.json(
      { ok: false, code: BROADCAST_CODES.notAuthenticated, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const sidRaw = req.nextUrl.searchParams.get("broadcastSessionId")?.trim() ?? "";
  const broadcastSessionId = Number(sidRaw);
  if (!Number.isFinite(broadcastSessionId) || broadcastSessionId <= 0) {
    return NextResponse.json(
      { ok: false, code: BROADCAST_CODES.scheduleInvalid, error: "Invalid broadcastSessionId" },
      { status: 400 }
    );
  }

  const host = await assertMeetBroadcastHost(userId, req.nextUrl.searchParams.get("hostWallet"));
  if (!host.ok) {
    return NextResponse.json({ ok: false, code: host.code, error: host.error }, { status: host.status });
  }

  const own = await assertTimelineSessionOwned(broadcastSessionId, userId);
  if (!own.ok) {
    const code =
      own.code === "not_found" ? BROADCAST_CODES.broadcastTimelineNotFound : BROADCAST_CODES.broadcastTimelineForbidden;
    const status = own.code === "not_found" ? 404 : 403;
    return NextResponse.json(
      { ok: false, code, error: own.code === "not_found" ? "Session not found" : "Not allowed" },
      { status }
    );
  }

  const limitRaw = req.nextUrl.searchParams.get("limit");
  const limit = limitRaw ? Number(limitRaw) : undefined;

  const [events, summary] = await Promise.all([
    listBroadcastTimelineEvents(broadcastSessionId, { limit }),
    buildBroadcastTimelineSummary(broadcastSessionId),
  ]);

  return NextResponse.json({
    ok: true,
    events: events.map((e) => ({
      id: e.id,
      broadcastSessionId: e.broadcastSessionId,
      userId: e.userId,
      eventType: e.eventType,
      eventAtIso: e.eventAtIso,
      summary: e.summary,
      detailsJson: e.detailsJson,
    })),
    summary,
  });
}
