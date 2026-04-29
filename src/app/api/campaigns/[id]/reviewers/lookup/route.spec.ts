/**
 * @jest-environment node
 */
import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import { NextRequest } from "next/server";
import { GET } from "./route";
import { getAuthedUserId } from "@/lib/api/auth";
import { getDb } from "@/lib/db";
import { requireCampaignReviewerAssignmentManageAuth } from "@/lib/revenue-os/campaign-reviewer-assignment-manage";
import type { CampaignRow } from "@/lib/db/schema";

jest.mock("next/headers", () => ({
  cookies: jest.fn(async () => ({ get: jest.fn(() => undefined) })),
}));

jest.mock("@/lib/api/auth");
jest.mock("@/lib/db");
jest.mock("@/lib/revenue-os/campaign-reviewer-assignment-manage");

const campaignStub = { id: "camp-1", userId: "9", name: "C", clientId: "cl" } as CampaignRow;

function setupLookupDb(rows: { id: number; username: string; email: string }[]) {
  const limit = jest.fn(async () => rows);
  const where = jest.fn(() => ({ limit }));
  const from = jest.fn(() => ({ where }));
  const select = jest.fn(() => ({ from }));
  (getDb as jest.Mock).mockResolvedValue({ select });
  return { limit, where };
}

describe("/api/campaigns/[id]/reviewers/lookup GET", () => {
  beforeEach(() => {
    jest.mocked(getAuthedUserId).mockReset();
    (getDb as jest.Mock).mockReset();
    jest.mocked(requireCampaignReviewerAssignmentManageAuth).mockReset();
    jest.mocked(requireCampaignReviewerAssignmentManageAuth).mockResolvedValue({
      ok: true,
      campaign: campaignStub,
    });
  });

  it("returns 401 when unauthenticated", async () => {
    jest.mocked(getAuthedUserId).mockResolvedValue(null);
    const res = await GET(new NextRequest("http://localhost/api/campaigns/c1/reviewers/lookup?q=ab"), {
      params: Promise.resolve({ id: "c1" }),
    });
    expect(res.status).toBe(401);
    const j = (await res.json()) as { error: string };
    expect(j.error).toBe("UNAUTHORIZED");
  });

  it("returns 403 when manage auth fails", async () => {
    jest.mocked(getAuthedUserId).mockResolvedValue(9);
    jest.mocked(requireCampaignReviewerAssignmentManageAuth).mockResolvedValue({
      ok: false,
      status: 403,
      body: {
        error: "FORBIDDEN_REVIEWER_MANAGEMENT",
        message: "You do not have permission to manage reviewers for this campaign.",
      },
    });
    const res = await GET(new NextRequest("http://localhost/api/campaigns/c1/reviewers/lookup?q=ab"), {
      params: Promise.resolve({ id: "c1" }),
    });
    expect(res.status).toBe(403);
  });

  it("returns empty candidates when q too short after auth", async () => {
    jest.mocked(getAuthedUserId).mockResolvedValue(9);
    (getDb as jest.Mock).mockResolvedValue({});
    const res = await GET(new NextRequest("http://localhost/api/campaigns/c1/reviewers/lookup?q=a"), {
      params: Promise.resolve({ id: "c1" }),
    });
    expect(res.status).toBe(200);
    const j = (await res.json()) as { candidates: unknown[] };
    expect(j.candidates).toEqual([]);
  });

  it("applies default limit 8", async () => {
    jest.mocked(getAuthedUserId).mockResolvedValue(9);
    const { limit } = setupLookupDb([]);
    const res = await GET(new NextRequest("http://localhost/api/campaigns/c1/reviewers/lookup?q=te"), {
      params: Promise.resolve({ id: "c1" }),
    });
    expect(res.status).toBe(200);
    expect(limit).toHaveBeenCalledWith(8);
  });

  it("clamps limit to max 10", async () => {
    jest.mocked(getAuthedUserId).mockResolvedValue(9);
    const { limit } = setupLookupDb([]);
    await GET(
      new NextRequest("http://localhost/api/campaigns/c1/reviewers/lookup?q=te&limit=500"),
      { params: Promise.resolve({ id: "c1" }) }
    );
    expect(limit).toHaveBeenCalledWith(10);
  });

  it("returns mapped candidates newest query order from DB", async () => {
    jest.mocked(getAuthedUserId).mockResolvedValue(9);
    setupLookupDb([
      { id: 1, username: "alice", email: "a@x.com" },
      { id: 2, username: "bob", email: "b@x.com" },
    ]);
    const res = await GET(new NextRequest("http://localhost/api/campaigns/c1/reviewers/lookup?q=al"), {
      params: Promise.resolve({ id: "c1" }),
    });
    const j = (await res.json()) as {
      candidates: { userId: number; displayName: string; email: string }[];
    };
    expect(j.candidates).toHaveLength(2);
    expect(j.candidates[0]).toMatchObject({ userId: 1, displayName: "alice" });
  });
});
