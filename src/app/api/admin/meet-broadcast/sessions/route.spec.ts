/**
 * @jest-environment node
 */
import { describe, it, expect, jest, beforeEach, afterEach } from "@jest/globals";
import { NextRequest } from "next/server";
import { GET } from "./route";
import { verifyToken } from "@/lib/auth";
import { fetchMeetBroadcastSessionsForAdmin } from "@/lib/meet/broadcast-admin";

jest.mock("@/lib/auth", () => ({
  verifyToken: jest.fn(),
}));

jest.mock("@/lib/meet/broadcast-admin", () => ({
  fetchMeetBroadcastSessionsForAdmin: jest.fn(),
}));

jest.mock("@/lib/meet/broadcast-timeline-store", () => ({
  getBroadcastTimelinePreviewForSession: jest.fn(async () => ({
    eventCount: 0,
    latestEvent: null,
  })),
}));

jest.mock("@/lib/meet/broadcast-calendar-link-store", () => ({
  getBroadcastCalendarLinkByBroadcastEventId: jest.fn(async () => null),
}));

const mockVerify = verifyToken as jest.MockedFunction<typeof verifyToken>;
const mockFetch = fetchMeetBroadcastSessionsForAdmin as jest.MockedFunction<
  typeof fetchMeetBroadcastSessionsForAdmin
>;

function req(url: string) {
  return new NextRequest(url, { headers: { cookie: "admin-token=fakejwt" } });
}

describe("GET /api/admin/meet-broadcast/sessions", () => {
  let errSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    errSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    errSpy.mockRestore();
  });

  it("returns 401 without admin-token cookie", async () => {
    const res = await GET(new NextRequest("http://localhost/api/admin/meet-broadcast/sessions"));
    expect(res.status).toBe(401);
  });

  it("returns 401 when token is not admin", async () => {
    mockVerify.mockReturnValueOnce({ isAdmin: false });
    const res = await GET(req("http://localhost/api/admin/meet-broadcast/sessions"));
    expect(res.status).toBe(401);
  });

  it("passes query filters to fetch and returns sanitized payload", async () => {
    mockVerify.mockReturnValueOnce({ isAdmin: true });
    const startedAt = new Date("2026-01-02T00:00:00.000Z");
    mockFetch.mockResolvedValueOnce([
      {
        session: {
          id: 1,
          roomId: "room-x",
          userId: 42,
          livekitEgressId: "EG_1",
          status: "active",
          layoutMode: "grid",
          recordingEnabled: false,
          sceneConfigJson: null,
          startedAt,
          endedAt: null,
          createdAt: startedAt,
          updatedAt: startedAt,
        } as never,
        destinations: [
          {
            id: 10,
            broadcastSessionId: 1,
            streamDestinationId: 99,
            platform: "twitch",
            label: "Main",
            resolvedOutputUrlMasked: "rtmp://x/****abcd",
            status: "active",
            lastError: null,
            startedAt,
            endedAt: null,
          } as never,
        ],
      },
    ]);

    const res = await GET(
      req(
        "http://localhost/api/admin/meet-broadcast/sessions?limit=10&status=active&roomId=room-x&userId=42"
      )
    );
    expect(res.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledWith({
      limit: 10,
      status: "active",
      roomId: "room-x",
      userId: 42,
    });
    const body = (await res.json()) as {
      ok: boolean;
      count: number;
      sessions: Array<{ session: { id: number }; destinations: Array<{ id: number }> }>;
    };
    expect(body.ok).toBe(true);
    expect(body.count).toBe(1);
    expect(body.sessions[0].session.id).toBe(1);
    expect(body.sessions[0].destinations[0].resolvedOutputUrlMasked).toBe("rtmp://x/****abcd");
    const s0 = body.sessions[0].session as {
      timelineEventCount?: number;
      analyticsSummaryPreview?: { destinationCount?: number };
    };
    expect(s0.timelineEventCount).toBe(0);
    expect(s0.analyticsSummaryPreview?.destinationCount).toBe(1);
  });
});
