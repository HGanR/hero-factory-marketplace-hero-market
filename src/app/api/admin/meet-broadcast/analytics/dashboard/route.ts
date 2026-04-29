import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { BROADCAST_CODES } from "@/lib/meet/broadcast-codes";
import {
  normalizeBroadcastAnalyticsFilters,
  parseBroadcastAnalyticsFiltersFromSearchParams,
} from "@/lib/meet/broadcast-analytics-dashboard";
import { buildDashboardDataForAdmin } from "@/lib/meet/broadcast-analytics-dashboard-store";
import { incrementBroadcastAnalyticsDashboardView } from "@/lib/meet/broadcast-metrics";

/**
 * GET /api/admin/meet-broadcast/analytics/dashboard
 * Cross-session aggregate analytics (admin). Optional userId narrows to one host.
 */
export async function GET(request: NextRequest) {
  const token = request.cookies.get("admin-token")?.value;
  if (!token) {
    return NextResponse.json({ ok: false, error: "Unauthorized (missing admin token)" }, { status: 401 });
  }
  const decoded = verifyToken(token);
  if (!decoded?.isAdmin) {
    return NextResponse.json({ ok: false, error: "Unauthorized (not admin)" }, { status: 401 });
  }

  const parsed = parseBroadcastAnalyticsFiltersFromSearchParams(request.nextUrl.searchParams, {
    allowUserIdFilter: true,
  });
  if (!parsed.ok) {
    return NextResponse.json(
      { ok: false, code: BROADCAST_CODES.broadcastAnalyticsDashboardInvalid, error: parsed.error },
      { status: 400 }
    );
  }

  const normalized = normalizeBroadcastAnalyticsFilters(parsed.filters);
  if (!normalized.ok) {
    return NextResponse.json(
      { ok: false, code: BROADCAST_CODES.broadcastAnalyticsDashboardInvalid, error: normalized.error },
      { status: 400 }
    );
  }

  try {
    const body = await buildDashboardDataForAdmin(normalized.filters);
    incrementBroadcastAnalyticsDashboardView({
      userId: normalized.filters.userId ?? null,
      roomId: normalized.filters.roomId ?? null,
      sessionId: null,
      reason: `admin:${normalized.filters.dateRange}`,
    });

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
