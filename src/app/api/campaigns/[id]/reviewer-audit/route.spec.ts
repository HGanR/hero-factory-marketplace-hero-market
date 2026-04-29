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

function setupDbChain(rows: unknown[]) {
  const limit = jest.fn(async () => rows);
  const orderBy = jest.fn(() => ({ limit }));
  const where = jest.fn(() => ({ orderBy }));
  const from = jest.fn(() => ({ where }));
  const select = jest.fn(() => ({ from }));
  (getDb as jest.Mock).mockResolvedValue({ select });
  return { limit, orderBy };
}

const campaignStub = {
  id: "camp-1",
  userId: "9",
  name: "Camp",
  clientId: "cl-1",
} as CampaignRow;

describe("/api/campaigns/[id]/reviewer-audit GET", () => {
  beforeEach(() => {
    jest.mocked(getAuthedUserId).mockReset();
    (getDb as jest.Mock).mockReset();
    jest.mocked(requireCampaignReviewerAssignmentManageAuth).mockReset();
  });

  it("returns 401 when unauthenticated", async () => {
    jest.mocked(getAuthedUserId).mockResolvedValue(null);
    const res = await GET(new NextRequest("http://localhost/api/campaigns/camp-1/reviewer-audit"), {
      params: Promise.resolve({ id: "camp-1" }),
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
    const res = await GET(new NextRequest("http://localhost/api/campaigns/camp-1/reviewer-audit"), {
      params: Promise.resolve({ id: "camp-1" }),
    });
    expect(res.status).toBe(403);
  });

  it("uses default limit 10", async () => {
    jest.mocked(getAuthedUserId).mockResolvedValue(9);
    jest.mocked(requireCampaignReviewerAssignmentManageAuth).mockResolvedValue({
      ok: true,
      campaign: campaignStub,
    });
    const { limit } = setupDbChain([]);
    const res = await GET(new NextRequest("http://localhost/api/campaigns/camp-1/reviewer-audit"), {
      params: Promise.resolve({ id: "camp-1" }),
    });
    expect(res.status).toBe(200);
    expect(limit).toHaveBeenCalledWith(10);
  });

  it("clamps limit to max 25", async () => {
    jest.mocked(getAuthedUserId).mockResolvedValue(9);
    jest.mocked(requireCampaignReviewerAssignmentManageAuth).mockResolvedValue({
      ok: true,
      campaign: campaignStub,
    });
    const { limit } = setupDbChain([]);
    await GET(
      new NextRequest("http://localhost/api/campaigns/camp-1/reviewer-audit?limit=500"),
      { params: Promise.resolve({ id: "camp-1" }) }
    );
    expect(limit).toHaveBeenCalledWith(25);
  });

  it("returns newest-first mapped events", async () => {
    jest.mocked(getAuthedUserId).mockResolvedValue(9);
    jest.mocked(requireCampaignReviewerAssignmentManageAuth).mockResolvedValue({
      ok: true,
      campaign: campaignStub,
    });
    const rows = [
      {
        id: "newer",
        campaignId: "camp-1",
        action: "reviewer_added",
        targetUserId: "5",
        actorUserId: "9",
        previousRole: null,
        nextRole: "approver",
        createdAt: new Date("2026-02-02T00:00:00.000Z"),
      },
      {
        id: "older",
        campaignId: "camp-1",
        action: "reviewer_removed",
        targetUserId: "5",
        actorUserId: "9",
        previousRole: "approver",
        nextRole: null,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      },
    ];
    setupDbChain(rows);
    const res = await GET(new NextRequest("http://localhost/api/campaigns/camp-1/reviewer-audit"), {
      params: Promise.resolve({ id: "camp-1" }),
    });
    const j = (await res.json()) as {
      events: { id: string; action: string; targetUserId: number; previousRole: string | null }[];
    };
    expect(j.events[0]!.id).toBe("newer");
    expect(j.events[1]!.id).toBe("older");
    expect(j.events[0]!.targetUserId).toBe(5);
    expect(j.events[1]!.previousRole).toBe("approver");
  });
});
