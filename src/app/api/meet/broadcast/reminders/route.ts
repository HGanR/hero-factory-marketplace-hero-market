import { NextRequest, NextResponse } from "next/server";
import { getAuthedUserId } from "@/lib/api/auth";
import { assertMeetBroadcastHost } from "@/lib/meet/broadcast-host";
import { BROADCAST_CODES } from "@/lib/meet/broadcast-codes";
import { listUpcomingBroadcastRemindersForUser } from "@/lib/meet/broadcast-reminder-service";
import { BROADCAST_REMINDERS_COMPUTED_ONLY } from "@/lib/meet/broadcast-reminders";
import { incrementBroadcastRemindersView } from "@/lib/meet/broadcast-metrics";

/**
 * GET /api/meet/broadcast/reminders?hostWallet=&horizonHours=
 * Reminders are computed on each request (no server-side persistence in this phase).
 */
export async function GET(req: NextRequest) {
  const userId = await getAuthedUserId();
  if (userId == null) {
    return NextResponse.json(
      { ok: false, code: BROADCAST_CODES.notAuthenticated, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const host = await assertMeetBroadcastHost(userId, req.nextUrl.searchParams.get("hostWallet"));
  if (!host.ok) {
    return NextResponse.json({ ok: false, code: host.code, error: host.error }, { status: host.status });
  }

  const hRaw = req.nextUrl.searchParams.get("horizonHours");
  const horizonHours = hRaw != null && Number.isFinite(Number(hRaw)) ? Number(hRaw) : undefined;

  const nowIso = new Date().toISOString();
  const reminders = await listUpcomingBroadcastRemindersForUser(userId, nowIso, { horizonHours });

  incrementBroadcastRemindersView({ userId, roomId: null, sessionId: null });

  return NextResponse.json({
    ok: true,
    computedOnly: BROADCAST_REMINDERS_COMPUTED_ONLY,
    generatedAtIso: nowIso,
    count: reminders.length,
    reminders,
  });
}
