/**
 * @jest-environment node
 */
import { describe, it, expect, jest, beforeEach, afterEach } from "@jest/globals";
import { NextRequest } from "next/server";
import { GET, POST } from "./route";
import { getAuthedUserId } from "@/lib/api/auth";
import { getDb } from "@/lib/db";
import { recordReviewerAddedAuditAndNotify } from "@/lib/revenue-os/campaign-reviewer-assignment-audit";
import { requireCampaignReviewerAssignmentManageAuth } from "@/lib/revenue-os/campaign-reviewer-assignment-manage";
import type { CampaignRow } from "@/lib/db/schema";

jest.mock("next/headers", () => ({
  cookies: jest.fn(async () => ({ get: jest.fn(() => undefined) })),
}));

jest.mock("@/lib/api/auth");
jest.mock("@/lib/db");
jest.mock("@/lib/revenue-os/campaign-reviewer-assignment-manage");

jest.mock("@/lib/revenue-os/campaign-reviewer-assignment-audit", () => {
  const actual = jest.requireActual("@/lib/revenue-os/campaign-reviewer-assignment-audit");
  return {
    ...actual,
    recordReviewerAddedAuditAndNotify: jest.fn(() => Promise.resolve()),
  };
});

const campaignStub = {
  id: "camp-1",
  userId: "99",
  name: "Test Campaign",
  clientId: "cl-1",
} as CampaignRow;

function buildPostDbMock(selectQueues: unknown[][]) {
  const queue = [...selectQueues];
  const limitFn = jest.fn(async () => queue.shift() ?? []);
  const db = {
    insert: jest.fn(() => ({
      values: jest.fn(() => Promise.resolve()),
    })),
    select: jest.fn(() => ({
      from: jest.fn(() => ({
        where: jest.fn(() => ({
          limit: limitFn,
        })),
      })),
    })),
  };
  return db;
}

async function flushFollowUp() {
  await new Promise<void>((r) => setImmediate(r));
}

describe("/api/campaigns/[id]/reviewers", () => {
  let savedGovernanceTier: string | undefined;

  beforeEach(() => {
    savedGovernanceTier = process.env.REVENUE_OS_GOVERNANCE_TIER;
  });

  afterEach(() => {
    if (savedGovernanceTier === undefined) delete process.env.REVENUE_OS_GOVERNANCE_TIER;
    else process.env.REVENUE_OS_GOVERNANCE_TIER = savedGovernanceTier;
  });

  describe("POST", () => {
    beforeEach(() => {
      jest.mocked(getAuthedUserId).mockReset();
      (getDb as jest.Mock).mockReset();
      jest.mocked(requireCampaignReviewerAssignmentManageAuth).mockReset();
      jest.mocked(recordReviewerAddedAuditAndNotify).mockClear();
      jest.mocked(requireCampaignReviewerAssignmentManageAuth).mockResolvedValue({
        ok: true,
        campaign: campaignStub,
      });
    });

    it("records reviewer_added follow-up after successful insert", async () => {
    jest.mocked(getAuthedUserId).mockResolvedValue(9);
    const assignmentRow = {
      id: "new-asg",
      campaignId: "camp-1",
      userId: "7",
      role: "approver",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    };
    (getDb as jest.Mock).mockResolvedValue(
      buildPostDbMock([[{ id: 7 }], [], [assignmentRow]])
    );

    const req = new NextRequest("http://localhost/api/campaigns/camp-1/reviewers", {
      method: "POST",
      body: JSON.stringify({ userId: 7, role: "approver" }),
    });
    const res = await POST(req, { params: Promise.resolve({ id: "camp-1" }) });
    expect(res.status).toBe(200);
    await flushFollowUp();
    expect(recordReviewerAddedAuditAndNotify).toHaveBeenCalledTimes(1);
    expect(recordReviewerAddedAuditAndNotify).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        campaignId: "camp-1",
        campaignName: "Test Campaign",
        clientId: "cl-1",
        targetUserId: 7,
        actorUserId: 9,
        role: "approver",
      })
    );
  });

  it("does not record audit when duplicate assignment", async () => {
    jest.mocked(getAuthedUserId).mockResolvedValue(9);
    const dup = {
      id: "old",
      campaignId: "camp-1",
      userId: "7",
      role: "reviewer",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    (getDb as jest.Mock).mockResolvedValue(buildPostDbMock([[{ id: 7 }], [dup]]));

    const req = new NextRequest("http://localhost/api/campaigns/camp-1/reviewers", {
      method: "POST",
      body: JSON.stringify({ userId: 7, role: "approver" }),
    });
    const res = await POST(req, { params: Promise.resolve({ id: "camp-1" }) });
    expect(res.status).toBe(409);
    await flushFollowUp();
    expect(recordReviewerAddedAuditAndNotify).not.toHaveBeenCalled();
  });

    it("returns FEATURE_NOT_AVAILABLE when plan tier blocks reviewer assignments", async () => {
      process.env.REVENUE_OS_GOVERNANCE_TIER = "starter";
      jest.mocked(getAuthedUserId).mockResolvedValue(9);
      (getDb as jest.Mock).mockResolvedValue({});
      const req = new NextRequest("http://localhost/api/campaigns/camp-1/reviewers", {
        method: "POST",
        body: JSON.stringify({ userId: 7, role: "approver" }),
      });
      const res = await POST(req, { params: Promise.resolve({ id: "camp-1" }) });
      expect(res.status).toBe(403);
      const j = (await res.json()) as { error: string };
      expect(j.error).toBe("FEATURE_NOT_AVAILABLE");
      await flushFollowUp();
      expect(recordReviewerAddedAuditAndNotify).not.toHaveBeenCalled();
    });
  });

  describe("GET", () => {
    beforeEach(() => {
      jest.mocked(getAuthedUserId).mockReset();
      (getDb as jest.Mock).mockReset();
      jest.mocked(requireCampaignReviewerAssignmentManageAuth).mockReset();
      jest.mocked(requireCampaignReviewerAssignmentManageAuth).mockResolvedValue({
        ok: true,
        campaign: campaignStub,
      });
    });

    it("returns FEATURE_NOT_AVAILABLE when plan tier blocks reviewer assignments", async () => {
      process.env.REVENUE_OS_GOVERNANCE_TIER = "starter";
      jest.mocked(getAuthedUserId).mockResolvedValue(99);
      (getDb as jest.Mock).mockResolvedValue({});
      const res = await GET(new NextRequest("http://localhost/api/campaigns/camp-1/reviewers"), {
        params: Promise.resolve({ id: "camp-1" }),
      });
      expect(res.status).toBe(403);
      const j = (await res.json()) as { error: string };
      expect(j.error).toBe("FEATURE_NOT_AVAILABLE");
    });
  });
});
