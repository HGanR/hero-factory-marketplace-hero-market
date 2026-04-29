/**
 * @jest-environment node
 */
import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import { NextRequest } from "next/server";
import { GET } from "./route";

jest.mock("@/lib/api/auth", () => ({
  getAuthedUserId: jest.fn(),
}));

jest.mock("@/lib/meet/broadcast-host", () => ({
  assertMeetBroadcastHost: jest.fn(),
}));

jest.mock("@/lib/meet/broadcast-analytics-dashboard-store", () => ({
  buildDashboardDataForUser: jest.fn(),
}));

jest.mock("@/lib/meet/broadcast-metrics", () => ({
  incrementBroadcastAnalyticsDashboardView: jest.fn(),
  incrementBroadcastAnalyticsDashboardFilter: jest.fn(),
}));

import { getAuthedUserId } from "@/lib/api/auth";
import { assertMeetBroadcastHost } from "@/lib/meet/broadcast-host";
import { buildDashboardDataForUser } from "@/lib/meet/broadcast-analytics-dashboard-store";

describe("GET /api/meet/broadcast/analytics/dashboard", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 401 when anonymous", async () => {
    (getAuthedUserId as jest.Mock).mockResolvedValueOnce(null);
    const res = await GET(new NextRequest("http://localhost/api/meet/broadcast/analytics/dashboard"));
    expect(res.status).toBe(401);
  });

  it("returns 400 on invalid range", async () => {
    (getAuthedUserId as jest.Mock).mockResolvedValueOnce(1);
    (assertMeetBroadcastHost as jest.Mock).mockResolvedValueOnce({ ok: true });
    const res = await GET(
      new NextRequest("http://localhost/api/meet/broadcast/analytics/dashboard?range=bad&hostWallet=0xabc")
    );
    expect(res.status).toBe(400);
    const j = (await res.json()) as { code?: string };
    expect(j.code).toBe("broadcast_analytics_dashboard_invalid");
  });

  it("returns summary on success", async () => {
    (getAuthedUserId as jest.Mock).mockResolvedValueOnce(1);
    (assertMeetBroadcastHost as jest.Mock).mockResolvedValueOnce({ ok: true });
    (buildDashboardDataForUser as jest.Mock).mockResolvedValueOnce({
      summary: { totalSessions: 2, liveSessions: 0, completedSessions: 2 },
      breakdowns: { sessionsByDay: [] },
      filtersApplied: { dateRange: "last_30_days", fromIso: "a", toIso: "b" },
      generatedAt: "2026-04-01T00:00:00.000Z",
      sessionsTruncated: false,
      sessionSampleSize: 2,
      recentSessions: [],
    });
    const res = await GET(
      new NextRequest("http://localhost/api/meet/broadcast/analytics/dashboard?hostWallet=0xabc&range=last_7_days")
    );
    expect(res.status).toBe(200);
    const j = (await res.json()) as { ok?: boolean; summary?: { totalSessions: number } };
    expect(j.ok).toBe(true);
    expect(j.summary?.totalSessions).toBe(2);
  });
});
