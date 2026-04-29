/**
 * @jest-environment node
 */
import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import { NextRequest, NextResponse } from "next/server";
import { GET } from "./route";
import { getAuthedUserId } from "@/lib/api/auth";
import { getDb } from "@/lib/db";
import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";

jest.mock("@/lib/api/auth");
jest.mock("@/lib/db");
jest.mock("@/lib/revenue-os-api-access", () => ({
  enforceRevenueOsApiAccess: jest.fn().mockResolvedValue(null),
}));

function setupDbChain(rows: unknown[]) {
  const limit = jest.fn(async () => rows);
  const orderBy = jest.fn(() => ({ limit }));
  const where = jest.fn(() => ({ orderBy }));
  const from = jest.fn(() => ({ where }));
  const select = jest.fn(() => ({ from }));
  (getDb as jest.Mock).mockResolvedValue({ select });
  return { limit, orderBy };
}

describe("/api/revenue-os/approval-audit-recent GET", () => {
  beforeEach(() => {
    jest.mocked(getAuthedUserId).mockReset();
    (getDb as jest.Mock).mockReset();
    jest.mocked(enforceRevenueOsApiAccess).mockReset();
    jest.mocked(enforceRevenueOsApiAccess).mockResolvedValue(null);
  });

  it("returns 403 REVENUE_OS_ACCESS_DENIED when gate blocks the session", async () => {
    jest.mocked(enforceRevenueOsApiAccess).mockResolvedValueOnce(
      NextResponse.json(
        { error: "REVENUE_OS_ACCESS_DENIED", message: "See admin for access to Revenue OS." },
        { status: 403 }
      )
    );
    const res = await GET(new NextRequest("http://localhost/api/revenue-os/approval-audit-recent"));
    expect(res.status).toBe(403);
    const j = (await res.json()) as { error: string; message: string };
    expect(j.error).toBe("REVENUE_OS_ACCESS_DENIED");
  });

  it("returns 401 when unauthenticated", async () => {
    jest.mocked(getAuthedUserId).mockResolvedValue(null);
    const res = await GET(new NextRequest("http://localhost/api/revenue-os/approval-audit-recent"));
    expect(res.status).toBe(401);
    const j = (await res.json()) as { error: string };
    expect(j.error).toBe("UNAUTHORIZED");
  });

  it("uses default limit 5", async () => {
    jest.mocked(getAuthedUserId).mockResolvedValue(9);
    const { limit } = setupDbChain([]);
    const res = await GET(new NextRequest("http://localhost/api/revenue-os/approval-audit-recent"));
    expect(res.status).toBe(200);
    expect(limit).toHaveBeenCalledWith(5);
  });

  it("clamps limit to max 25", async () => {
    jest.mocked(getAuthedUserId).mockResolvedValue(9);
    const { limit } = setupDbChain([]);
    await GET(new NextRequest("http://localhost/api/revenue-os/approval-audit-recent?limit=200"));
    expect(limit).toHaveBeenCalledWith(25);
  });

  it("returns events in descending createdAt order as returned by the query", async () => {
    jest.mocked(getAuthedUserId).mockResolvedValue(9);
    const rows = [
      {
        id: "newer",
        postId: "a",
        action: "publish_approval_approved",
        platform: "linkedin",
        details: {},
        createdAt: new Date("2026-02-01T00:00:00.000Z"),
      },
      {
        id: "older",
        postId: "b",
        action: "publish_approval_rejected",
        platform: "x",
        details: { decidedByLabel: "Zed" },
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      },
    ];
    setupDbChain(rows);
    const res = await GET(new NextRequest("http://localhost/api/revenue-os/approval-audit-recent"));
    const j = (await res.json()) as { events: { id: string; actorDisplayName?: string }[] };
    expect(j.events[0].id).toBe("newer");
    expect(j.events[1].id).toBe("older");
    expect(j.events[1].actorDisplayName).toBe("Zed");
  });
});
