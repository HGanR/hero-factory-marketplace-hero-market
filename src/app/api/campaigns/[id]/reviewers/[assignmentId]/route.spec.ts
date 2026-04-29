/**
 * @jest-environment node
 */
import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import { NextRequest } from "next/server";
import { DELETE, PATCH } from "./route";
import { getAuthedUserId } from "@/lib/api/auth";
import { getDb } from "@/lib/db";
import {
  recordReviewerRemovedAuditAndNotify,
  recordReviewerRoleChangedAuditAndNotify,
} from "@/lib/revenue-os/campaign-reviewer-assignment-audit";
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
    recordReviewerRoleChangedAuditAndNotify: jest.fn(() => Promise.resolve()),
    recordReviewerRemovedAuditAndNotify: jest.fn(() => Promise.resolve()),
  };
});

const campaignStub = {
  id: "camp-1",
  userId: "99",
  name: "Test Campaign",
  clientId: "cl-1",
} as CampaignRow;

const baseAssignment = {
  id: "asg-1",
  campaignId: "camp-1",
  userId: "7",
  role: "editor",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
};

async function flushFollowUp() {
  await new Promise<void>((r) => setImmediate(r));
}

describe("/api/campaigns/[id]/reviewers/[assignmentId] PATCH", () => {
  beforeEach(() => {
    jest.mocked(getAuthedUserId).mockReset();
    (getDb as jest.Mock).mockReset();
    jest.mocked(requireCampaignReviewerAssignmentManageAuth).mockReset();
    jest.mocked(recordReviewerRoleChangedAuditAndNotify).mockClear();
    jest.mocked(requireCampaignReviewerAssignmentManageAuth).mockResolvedValue({
      ok: true,
      campaign: campaignStub,
    });
  });

  it("does not record audit on no-op role (normalized equal)", async () => {
    jest.mocked(getAuthedUserId).mockResolvedValue(9);
    let selectCalls = 0;
    (getDb as jest.Mock).mockResolvedValue({
      select: jest.fn(() => ({
        from: jest.fn(() => ({
          where: jest.fn(() => ({
            limit: jest.fn(async () => {
              selectCalls++;
              return [{ ...baseAssignment, role: "publisher" }];
            }),
          })),
        })),
      })),
    });

    const req = new NextRequest("http://localhost/api/campaigns/camp-1/reviewers/asg-1", {
      method: "PATCH",
      body: JSON.stringify({ role: "approver" }),
    });
    const res = await PATCH(req, {
      params: Promise.resolve({ id: "camp-1", assignmentId: "asg-1" }),
    });
    expect(res.status).toBe(200);
    await flushFollowUp();
    expect(recordReviewerRoleChangedAuditAndNotify).not.toHaveBeenCalled();
    expect(selectCalls).toBe(1);
  });

  it("records reviewer_role_changed when role changes", async () => {
    jest.mocked(getAuthedUserId).mockResolvedValue(9);
    const updated = { ...baseAssignment, role: "approver" };
    let pass = 0;
    (getDb as jest.Mock).mockResolvedValue({
      select: jest.fn(() => ({
        from: jest.fn(() => ({
          where: jest.fn(() => ({
            limit: jest.fn(async () => {
              pass++;
              if (pass === 1) return [baseAssignment];
              return [updated];
            }),
          })),
        })),
      })),
      update: jest.fn(() => ({
        set: jest.fn(() => ({
          where: jest.fn(() => Promise.resolve()),
        })),
      })),
    });

    const req = new NextRequest("http://localhost/api/campaigns/camp-1/reviewers/asg-1", {
      method: "PATCH",
      body: JSON.stringify({ role: "approver" }),
    });
    const res = await PATCH(req, {
      params: Promise.resolve({ id: "camp-1", assignmentId: "asg-1" }),
    });
    expect(res.status).toBe(200);
    await flushFollowUp();
    expect(recordReviewerRoleChangedAuditAndNotify).toHaveBeenCalledTimes(1);
    expect(recordReviewerRoleChangedAuditAndNotify).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        campaignId: "camp-1",
        targetUserId: 7,
        previousRole: "editor",
        nextRole: "approver",
      })
    );
  });
});

describe("/api/campaigns/[id]/reviewers/[assignmentId] DELETE", () => {
  beforeEach(() => {
    jest.mocked(getAuthedUserId).mockReset();
    (getDb as jest.Mock).mockReset();
    jest.mocked(requireCampaignReviewerAssignmentManageAuth).mockReset();
    jest.mocked(recordReviewerRemovedAuditAndNotify).mockClear();
    jest.mocked(requireCampaignReviewerAssignmentManageAuth).mockResolvedValue({
      ok: true,
      campaign: campaignStub,
    });
  });

  it("records reviewer_removed after delete", async () => {
    jest.mocked(getAuthedUserId).mockResolvedValue(9);
    (getDb as jest.Mock).mockResolvedValue({
      select: jest.fn(() => ({
        from: jest.fn(() => ({
          where: jest.fn(() => ({
            limit: jest.fn(async () => [baseAssignment]),
          })),
        })),
      })),
      delete: jest.fn(() => ({
        where: jest.fn(() => Promise.resolve()),
      })),
    });

    const res = await DELETE(
      new NextRequest("http://localhost/api/campaigns/camp-1/reviewers/asg-1", {
        method: "DELETE",
      }),
      { params: Promise.resolve({ id: "camp-1", assignmentId: "asg-1" }) }
    );
    expect(res.status).toBe(200);
    await flushFollowUp();
    expect(recordReviewerRemovedAuditAndNotify).toHaveBeenCalledTimes(1);
    expect(recordReviewerRemovedAuditAndNotify).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        campaignId: "camp-1",
        targetUserId: 7,
        previousRole: "editor",
      })
    );
  });
});
