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

jest.mock("@/lib/meet/broadcast-timeline-store", () => ({
  assertTimelineSessionOwned: jest.fn(),
  listBroadcastTimelineEvents: jest.fn(),
  buildBroadcastTimelineSummary: jest.fn(),
}));

import { getAuthedUserId } from "@/lib/api/auth";
import { assertMeetBroadcastHost } from "@/lib/meet/broadcast-host";
import {
  assertTimelineSessionOwned,
  listBroadcastTimelineEvents,
  buildBroadcastTimelineSummary,
} from "@/lib/meet/broadcast-timeline-store";

const mockUser = getAuthedUserId as jest.MockedFunction<typeof getAuthedUserId>;
const mockHost = assertMeetBroadcastHost as jest.MockedFunction<typeof assertMeetBroadcastHost>;
const mockOwn = assertTimelineSessionOwned as jest.MockedFunction<typeof assertTimelineSessionOwned>;
const mockList = listBroadcastTimelineEvents as jest.MockedFunction<typeof listBroadcastTimelineEvents>;
const mockSummary = buildBroadcastTimelineSummary as jest.MockedFunction<typeof buildBroadcastTimelineSummary>;

describe("GET /api/meet/broadcast/timeline", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 401 when not signed in", async () => {
    mockUser.mockResolvedValueOnce(null);
    const res = await GET(new NextRequest("http://localhost/api/meet/broadcast/timeline?broadcastSessionId=1"));
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid session id", async () => {
    mockUser.mockResolvedValueOnce(10);
    mockHost.mockResolvedValueOnce({ ok: true });
    const res = await GET(new NextRequest("http://localhost/api/meet/broadcast/timeline?broadcastSessionId=xx"));
    expect(res.status).toBe(400);
  });

  it("returns events when owned", async () => {
    mockUser.mockResolvedValueOnce(10);
    mockHost.mockResolvedValueOnce({ ok: true });
    mockOwn.mockResolvedValueOnce({ ok: true });
    mockList.mockResolvedValueOnce([
      {
        id: 1,
        broadcastSessionId: 5,
        userId: 10,
        eventType: "session_started",
        eventAtIso: "2026-01-01T00:00:00.000Z",
        summary: "ok",
        detailsJson: null,
      },
    ]);
    mockSummary.mockResolvedValueOnce({
      totalEvents: 1,
      countsByType: { session_started: 1 },
      firstEventAtIso: "2026-01-01T00:00:00.000Z",
      lastEventAtIso: "2026-01-01T00:00:00.000Z",
    });

    const res = await GET(
      new NextRequest("http://localhost/api/meet/broadcast/timeline?broadcastSessionId=5&hostWallet=0xabc")
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; events: { userId: number }[] };
    expect(body.ok).toBe(true);
    expect(body.events[0].userId).toBe(10);
  });
});
