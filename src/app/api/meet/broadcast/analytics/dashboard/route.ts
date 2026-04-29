import { NextRequest, NextResponse } from "next/server";
import { getAuthedUserId } from "@/lib/api/auth";
import { assertMeetBroadcastHost } from "@/lib/meet/broadcast-host";
import { BROADCAST_CODES } from "@/lib/meet/broadcast-codes";
import {
  normalizeBroadcastAnalyticsFilters,
  parseBroadcastAnalyticsFiltersFromSearchParams,
} from "@/lib/meet/broadcast-analytics-dashboard";
import { buildDashboardDataForUser } from "@/lib/meet/broadcast-analytics-dashboard-store";
import {
  incrementBroadcastAnalyticsDashboardFilter,
  incrementBroadcastAnalyticsDashboardView,
} from "@/lib/meet/broadcast-metrics";

/**
 * GET /api/meet/broadcast/analytics/dashboard
 * Cross-session aggregate analytics for the signed-in host (bounded, operational).
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

  const parsed = parseBroadcastAnalyticsFiltersFromSearchParams(req.nextUrl.searchParams, {
    allowUserIdFilter: false,
  });
  if (!parsed.ok) {
    return NextResponse.json(
      { ok: false, code: BROADCAST_CODES.broadcastAnalyticsDashboardInvalid, error: parsed.error },
      { status: 400 }
    );
  }

  const normalized = normalizeBroadcastAnalyticsFilters({ ...parsed.filters, userId: undefined });
  if (!normalized.ok) {
    return NextResponse.json(
      { ok: false, code: BROADCAST_CODES.broadcastAnalyticsDashboardInvalid, error: normalized.error },
      { status: 400 }
    );
  }

  try {
    const body = await buildDashboardDataForUser(userId, normalized.filters);
    incrementBroadcastAnalyticsDashboardView({
      userId,
      roomId: parsed.filters.roomId ?? null,
      sessionId: null,
      reason: normalized.filters.dateRange,
    });
    const hasFilter =
      parsed.filters.compositorMode != null ||
      parsed.filters.broadcastEventLinked != null ||
      parsed.filters.calendarLinked != null ||
      (parsed.filters.roomId != null && parsed.filters.roomId !== "");
    if (hasFilter) {
      incrementBroadcastAnalyticsDashboardFilter({ userId, roomId: parsed.filters.roomId ?? null, sessionId: null });
    }

    return NextResponse.json({
      ok: true,
      summary: body.summary,
      breakdowns: body.breakdowns,
      filtersApplied: body.filtersApplied,
      generatedAt: body.generatedAt,
      sessionsTruncated: body.sessionsTruncated,
      sessionSampleSize: body.sessionSampleSize,
      recentSessions: body.recentSessions,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message.slice(0, 200) : "dashboard_failed";
    return NextResponse.json(
      { ok: false, code: BROADCAST_CODES.broadcastAnalyticsDashboardInvalid, error: msg },
      { status: 500 }
    );
  }
}
