import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import { NextRequest } from "next/server";
import { POST } from "./route";

jest.mock("@/lib/social/external-social-publish-approval", () => ({
  resolveExternalSocialReviewTokenContext: jest.fn(),
  campaignPostVisibleOnExternalSocialReviewQueue: jest.fn(() => true),
  getAwaitingRoleForExternalSocialReview: jest.fn(() => "approver"),
  externalAllowedRolesCoverAwaitingRole: jest.fn(() => true),
}));

jest.mock("@/lib/revenue-os/apply-campaign-post-publish-approval-write", () => ({
  applyCampaignPostPublishApprovalWrite: jest.fn(() => ({
    outcome: "accepted_fresh",
    mergedUtm: { bentley_approval_status: "approved" },
    auditAction: "publish_approval_approved",
    auditDetails: {},
    publishApprovalNotify: undefined,
    parsedBentleyApprovalReason: null,
  })),
}));

const selectMock = jest.fn();

jest.mock("@/lib/db", () => ({
  getDb: jest.fn(async () => ({
    select: () => ({ from: () => ({ where: () => ({ limit: () => selectMock() }) }) }),
    insert: () => ({ values: jest.fn(async () => {}) }),
    update: () => ({ set: () => ({ where: jest.fn(async () => {}) }) }),
  })),
}));

const ext = jest.requireMock("@/lib/social/external-social-publish-approval") as {
  resolveExternalSocialReviewTokenContext: jest.Mock;
};

describe("POST /api/external/social-publish-approval/posts/[postId]/decision", () => {
  beforeEach(() => {
    selectMock.mockReset();
    ext.resolveExternalSocialReviewTokenContext.mockReset();
    ext.resolveExternalSocialReviewTokenContext.mockResolvedValue({
      tokenRow: {
        id: "tok1",
        campaignId: "c1",
        createdByUserId: "99",
        label: "Client",
        allowedRolesJson: ["approver"],
      },
      campaign: {
        id: "c1",
        userId: "1",
        clientId: "cl1",
        name: "Camp",
        publishApprovalChainJson: null,
      },
      allowedRoles: ["approver"],
    });
  });

  it("rejects without reason on reject", async () => {
    selectMock.mockResolvedValueOnce([
      {
        id: "p1",
        campaignId: "c1",
        platform: "linkedin",
        status: "SCHEDULED",
        caption: "x",
        utmParams: { bentley_approval_status: "pending_approval" },
        updatedAt: new Date("2026-01-02T00:00:00.000Z"),
        scheduledAt: null,
        hashtags: null,
        linkUrl: null,
        scheduledPublishMeta: null,
        platformPostId: null,
        errorMessage: null,
        socialAccountId: null,
        assetId: null,
        postedAt: null,
        createdAt: new Date(),
      },
    ]);
    const req = new NextRequest("http://localhost/api/external/social-publish-approval/posts/p1/decision", {
      method: "POST",
      body: JSON.stringify({
        token: "a".repeat(32),
        decision: "reject",
        approvalReviewSnapshot: {
          expectedApprovalStatus: "pending_approval",
          postUpdatedAt: "2026-01-02T00:00:00.000Z",
        },
      }),
    });
    const res = await POST(req, { params: Promise.resolve({ postId: "p1" }) });
    expect(res.status).toBe(400);
  });
});
