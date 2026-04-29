/**
 * @jest-environment node
 */
import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import { NextRequest } from "next/server";
import { GET } from "./route";
import { BROADCAST_CODES } from "@/lib/meet/broadcast-codes";

jest.mock("@/lib/api/auth", () => ({
  getAuthedUserId: jest.fn(async () => 100),
}));

jest.mock("@/lib/meet/broadcast-host", () => ({
  assertMeetBroadcastHost: jest.fn(async () => ({ ok: true as const })),
}));

jest.mock("@/lib/db", () => ({
  getDb: jest.fn(),
}));

jest.mock("@/lib/meet/broadcast-event-store", () => ({
  createBroadcastEvent: jest.fn(),
  listBroadcastEventsForUser: jest.fn(async () => []),
  listUpcomingBroadcastEvents: jest.fn(async () => []),
}));

jest.mock("@/lib/meet/broadcast-calendar-link-store", () => ({
  getBroadcastCalendarLinksByBroadcastEventIds: jest.fn(async () => new Map()),
}));

import { getAuthedUserId } from "@/lib/api/auth";
import { getDb } from "@/lib/db";
import { listUpcomingBroadcastEvents } from "@/lib/meet/broadcast-event-store";

const v2SessionRow = {
  id: 55,
  userId: 100,
  roomId: "r1",
  status: "active",
  layoutMode: "grid",
  sceneConfigJson: null,
  compositorMode: "v2_rendered_template",
  renderSessionId: 1,
  compositorFallbackFromV2: false,
  livekitEgressId: "eg",
  recordingEnabled: false,
  broadcastEventId: null,
  startedAt: new Date(),
  endedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("GET /api/meet/broadcast/events", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 401 when not authed", async () => {
    (getAuthedUserId as jest.Mock).mockResolvedValueOnce(null);
    const req = new NextRequest("http://localhost/api/meet/broadcast/events?broadcastSessionId=55");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid id", async () => {
    const req = new NextRequest("http://localhost/api/meet/broadcast/events?broadcastSessionId=xx");
    const res = await GET(req);
    expect(res.status).toBe(400);
    const j = (await res.json()) as { code?: string };
    expect(j.code).toBe(BROADCAST_CODES.scheduleInvalid);
  });

  it("returns text/event-stream for V2 host", async () => {
    (getDb as jest.Mock).mockResolvedValueOnce({
      select: () => ({
        from: () => ({
          where: () => ({
            limit: () => Promise.resolve([v2SessionRow]),
          }),
        }),
      }),
    });
    const ac = new AbortController();
    const req = new NextRequest("http://localhost/api/meet/broadcast/events?broadcastSessionId=55", {
      signal: ac.signal,
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/event-stream");
    const reader = res.body!.getReader();
    const { value } = await reader.read();
    expect(new TextDecoder().decode(value!)).toContain(": connected");
    ac.abort();
    await reader.cancel().catch(() => {});
  });

  it("returns JSON calendar events when broadcastSessionId is omitted", async () => {
    (listUpcomingBroadcastEvents as jest.Mock).mockResolvedValueOnce([
      {
        id: 1,
        userId: 100,
        title: "Show",
        description: null,
        scheduledStartIso: "2026-06-01T15:00:00.000Z",
        scheduledEndIso: null,
        timezone: null,
        roomId: "room-x",
        status: "scheduled",
        scenePresetId: null,
        defaultTimelineTemplateId: null,
        showPackageId: null,
        createdAtIso: "2026-01-01T00:00:00.000Z",
        updatedAtIso: "2026-01-01T00:00:00.000Z",
      },
    ]);
    const req = new NextRequest("http://localhost/api/meet/broadcast/events?upcoming=1");
    const res = await GET(req);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type") ?? "").toContain("application/json");
    const j = (await res.json()) as { events?: { id: number; title: string }[] };
    expect(j.events?.[0]?.id).toBe(1);
    expect(j.events?.[0]?.title).toBe("Show");
  });
});
