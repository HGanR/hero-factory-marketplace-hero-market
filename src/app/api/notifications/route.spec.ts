/**
 * @jest-environment node
 */
import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import { NextRequest } from "next/server";
import { GET } from "./route";
import { getAuthedUserId } from "@/lib/api/auth";
import { getDb } from "@/lib/db";

jest.mock("@/lib/api/auth");
jest.mock("@/lib/db");

function setupSelectChain(rows: unknown[]) {
  const limit = jest.fn(async () => rows);
  const orderBy = jest.fn(() => ({ limit }));
  const where = jest.fn(() => ({ orderBy }));
  const from = jest.fn(() => ({ where }));
  const select = jest.fn(() => ({ from }));
  (getDb as jest.Mock).mockResolvedValue({ select });
  return { limit };
}

describe("GET /api/notifications", () => {
  beforeEach(() => {
    jest.mocked(getAuthedUserId).mockReset();
    (getDb as jest.Mock).mockReset();
  });

  it("returns 401 when unauthenticated", async () => {
    jest.mocked(getAuthedUserId).mockResolvedValue(null);
    const res = await GET(new NextRequest("http://localhost/api/notifications"));
    expect(res.status).toBe(401);
  });

  it("uses default limit 10", async () => {
    jest.mocked(getAuthedUserId).mockResolvedValue(9);
    const { limit } = setupSelectChain([]);
    const res = await GET(new NextRequest("http://localhost/api/notifications"));
    expect(res.status).toBe(200);
    expect(limit).toHaveBeenCalledWith(10);
  });

  it("clamps limit to max 25", async () => {
    jest.mocked(getAuthedUserId).mockResolvedValue(9);
    const { limit } = setupSelectChain([]);
    await GET(new NextRequest("http://localhost/api/notifications?limit=500"));
    expect(limit).toHaveBeenCalledWith(25);
  });

  it("returns newest-first mapped events for current user query", async () => {
    jest.mocked(getAuthedUserId).mockResolvedValue(9);
    const rows = [
      {
        id: "n1",
        userId: "9",
        clientId: "",
        trustId: "",
        sourceType: "campaign_reviewer_assignment",
        eventType: "x",
        severity: "info",
        title: "",
        body: "Second",
        eventPayloadJson: { campaignId: "c2" },
        dedupeKey: null,
        createdAt: new Date("2026-02-02T00:00:00.000Z"),
        readAt: null,
      },
      {
        id: "n0",
        userId: "9",
        clientId: "",
        trustId: "",
        sourceType: "bentley_autonomous",
        eventType: "y",
        severity: "info",
        title: "First title",
        body: null,
        eventPayloadJson: null,
        dedupeKey: null,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        readAt: null,
      },
    ];
    setupSelectChain(rows);
    const res = await GET(new NextRequest("http://localhost/api/notifications"));
    const j = (await res.json()) as { events: { id: string; message: string }[] };
    expect(j.events[0]!.id).toBe("n1");
    expect(j.events[1]!.id).toBe("n0");
    expect(j.events[1]!.message).toBe("First title");
  });
});
