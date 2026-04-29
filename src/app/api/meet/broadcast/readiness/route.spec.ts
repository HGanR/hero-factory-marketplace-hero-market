/**
 * @jest-environment node
 */
import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import { NextRequest } from "next/server";
import { GET } from "./route";

jest.mock("@/lib/api/auth", () => ({ getAuthedUserId: jest.fn() }));
jest.mock("@/lib/meet/broadcast-host", () => ({ assertMeetBroadcastHost: jest.fn() }));
jest.mock("@/lib/meet/broadcast-launch-readiness-store", () => ({
  getBroadcastLaunchReadinessReportForEvent: jest.fn(),
}));
jest.mock("@/lib/meet/broadcast-audit", () => ({ broadcastAudit: jest.fn() }));
jest.mock("@/lib/meet/broadcast-metrics", () => ({ incrementBroadcastLaunchReadinessView: jest.fn() }));

import { getAuthedUserId } from "@/lib/api/auth";
import { assertMeetBroadcastHost } from "@/lib/meet/broadcast-host";
import { getBroadcastLaunchReadinessReportForEvent } from "@/lib/meet/broadcast-launch-readiness-store";

describe("GET /api/meet/broadcast/readiness", () => {
  beforeEach(() => jest.clearAllMocks());

  it("401 when anonymous", async () => {
    (getAuthedUserId as jest.Mock).mockResolvedValueOnce(null);
    const res = await GET(new NextRequest("http://localhost/api/meet/broadcast/readiness?broadcastEventId=1"));
    expect(res.status).toBe(401);
  });

  it("400 when missing event id", async () => {
    (getAuthedUserId as jest.Mock).mockResolvedValueOnce(1);
    (assertMeetBroadcastHost as jest.Mock).mockResolvedValueOnce({ ok: true });
    const res = await GET(new NextRequest("http://localhost/api/meet/broadcast/readiness"));
    expect(res.status).toBe(400);
  });

  it("404 when event not found", async () => {
    (getAuthedUserId as jest.Mock).mockResolvedValueOnce(1);
    (assertMeetBroadcastHost as jest.Mock).mockResolvedValueOnce({ ok: true });
    (getBroadcastLaunchReadinessReportForEvent as jest.Mock).mockResolvedValueOnce(null);
    const res = await GET(new NextRequest("http://localhost/api/meet/broadcast/readiness?broadcastEventId=9"));
    expect(res.status).toBe(404);
    const j = (await res.json()) as { code?: string };
    expect(j.code).toBe("broadcast_event_not_found");
  });

  it("200 with report", async () => {
    (getAuthedUserId as jest.Mock).mockResolvedValueOnce(1);
    (assertMeetBroadcastHost as jest.Mock).mockResolvedValueOnce({ ok: true });
    (getBroadcastLaunchReadinessReportForEvent as jest.Mock).mockResolvedValueOnce({
      broadcastEventId: 1,
      overallStatus: "ready",
      checks: [],
      computedAtIso: "2026-01-01T00:00:00.000Z",
    });
    const res = await GET(new NextRequest("http://localhost/api/meet/broadcast/readiness?broadcastEventId=1"));
    expect(res.status).toBe(200);
  });
});
