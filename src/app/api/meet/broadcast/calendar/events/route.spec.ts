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

jest.mock("@/lib/meet/broadcast-calendar-provider", () => ({
  listUpcomingExternalCalendarEvents: jest.fn(),
}));

import { getAuthedUserId } from "@/lib/api/auth";
import { assertMeetBroadcastHost } from "@/lib/meet/broadcast-host";
import { listUpcomingExternalCalendarEvents } from "@/lib/meet/broadcast-calendar-provider";

describe("GET /api/meet/broadcast/calendar/events", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 401 when anonymous", async () => {
    (getAuthedUserId as jest.Mock).mockResolvedValueOnce(null);
    const res = await GET(new NextRequest("http://localhost/api/meet/broadcast/calendar/events"));
    expect(res.status).toBe(401);
  });

  it("returns events on success", async () => {
    (getAuthedUserId as jest.Mock).mockResolvedValueOnce(1);
    (assertMeetBroadcastHost as jest.Mock).mockResolvedValueOnce({ ok: true });
    (listUpcomingExternalCalendarEvents as jest.Mock).mockResolvedValueOnce({
      ok: true,
      events: [{ externalEventId: "a", externalCalendarId: "primary", title: "T", startIso: "2026-01-01T00:00:00Z", endIso: "2026-01-01T01:00:00Z" }],
    });
    const res = await GET(new NextRequest("http://localhost/api/meet/broadcast/calendar/events?provider=google_calendar"));
    expect(res.status).toBe(200);
    const j = (await res.json()) as { events: unknown[] };
    expect(j.events.length).toBe(1);
  });
});
