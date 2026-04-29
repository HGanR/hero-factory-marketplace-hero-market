/**
 * @jest-environment node
 */
import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import { NextRequest } from "next/server";
import { GET } from "./route";

jest.mock("@/lib/api/auth", () => ({ getAuthedUserId: jest.fn() }));
jest.mock("@/lib/meet/broadcast-host", () => ({ assertMeetBroadcastHost: jest.fn() }));
jest.mock("@/lib/meet/broadcast-reminder-service", () => ({
  listUpcomingBroadcastRemindersForUser: jest.fn(),
}));
jest.mock("@/lib/meet/broadcast-metrics", () => ({ incrementBroadcastRemindersView: jest.fn() }));

import { getAuthedUserId } from "@/lib/api/auth";
import { assertMeetBroadcastHost } from "@/lib/meet/broadcast-host";
import { listUpcomingBroadcastRemindersForUser } from "@/lib/meet/broadcast-reminder-service";

describe("GET /api/meet/broadcast/reminders", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns computed reminders", async () => {
    (getAuthedUserId as jest.Mock).mockResolvedValueOnce(1);
    (assertMeetBroadcastHost as jest.Mock).mockResolvedValueOnce({ ok: true });
    (listUpcomingBroadcastRemindersForUser as jest.Mock).mockResolvedValueOnce([]);
    const res = await GET(new NextRequest("http://localhost/api/meet/broadcast/reminders"));
    expect(res.status).toBe(200);
    const j = (await res.json()) as { computedOnly?: boolean; ok?: boolean };
    expect(j.ok).toBe(true);
    expect(j.computedOnly).toBe(true);
  });
});
