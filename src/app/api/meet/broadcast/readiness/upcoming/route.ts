import { NextRequest, NextResponse } from "next/server";
import { getAuthedUserId } from "@/lib/api/auth";
import { assertMeetBroadcastHost } from "@/lib/meet/broadcast-host";
import { BROADCAST_CODES } from "@/lib/meet/broadcast-codes";
import { getUpcomingBroadcastLaunchReadinessReports } from "@/lib/meet/broadcast-launch-readiness-store";
import {
  incrementBroadcastLaunchReadinessAttention,
  incrementBroadcastLaunchReadinessBlocked,
  incrementBroadcastLaunchReadinessView,
} from "@/lib/meet/broadcast-metrics";

/**
 * GET /api/meet/broadcast/readiness/upcoming?hostWallet=&horizonHours=&maxEvents=
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
  const mRaw = req.nextUrl.searchParams.get("maxEvents");
  const horizonHours = hRaw != null && Number.isFinite(Number(hRaw)) ? Number(hRaw) : undefined;
  const maxEvents = mRaw != null && Number.isFinite(Number(mRaw)) ? Number(mRaw) : undefined;

  const items = await getUpcomingBroadcastLaunchReadinessReports(userId, { horizonHours, maxEvents });

  incrementBroadcastLaunchReadinessView({ userId, roomId: null, sessionId: null, reason: "upcoming" });
  if (items.some((i) => i.report.overallStatus === "blocked")) {
    incrementBroadcastLaunchReadinessBlocked({ userId, roomId: null, sessionId: null, reason: "upcoming_batch" });
  }
  if (items.some((i) => i.report.overallStatus === "attention_needed")) {
    incrementBroadcastLaunchReadinessAttention({ userId, roomId: null, sessionId: null, reason: "upcoming_batch" });
  }

  return NextResponse.json({
    ok: true,
    count: items.length,
    items: items.map(({ event, report }) => ({
      event: {
        id: event.id,
        title: event.title,
        scheduledStartIso: event.scheduledStartIso,
        roomId: event.roomId,
        status: event.status,
      },
      overallStatus: report.overallStatus,
      computedAtIso: report.computedAtIso,
    })),
    reports: items.map((i) => i.report),
  });
}
