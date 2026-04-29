import { describe, it, expect } from "@jest/globals";
import { applyCampaignPostPublishApprovalWrite } from "@/lib/revenue-os/apply-campaign-post-publish-approval-write";
import type { campaignPosts, campaigns } from "@/lib/db/schema";

function post(p: Partial<typeof campaignPosts.$inferSelect>): typeof campaignPosts.$inferSelect {
  return {
    id: "p1",
    campaignId: "c1",
    platform: "linkedin",
    assetId: null,
    scheduledAt: null,
    status: "SCHEDULED",
    caption: "Hi",
    hashtags: null,
    linkUrl: null,
    utmParams: { bentley_approval_status: "pending_approval" },
    scheduledPublishMeta: null,
    platformPostId: null,
    errorMessage: null,
    socialAccountId: null,
    postedAt: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-02T00:00:00.000Z"),
    ...p,
  } as typeof campaignPosts.$inferSelect;
}

function campaignRow(p: Partial<typeof campaigns.$inferSelect>): typeof campaigns.$inferSelect {
  return {
    id: "c1",
    userId: "1",
    clientId: "cl1",
    name: "C",
    objective: null,
    status: "DRAFT",
    startAt: null,
    endAt: null,
    publishApprovalChainJson: null,
    publishApprovalReportScheduleJson: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...p,
  } as typeof campaigns.$inferSelect;
}

describe("applyCampaignPostPublishApprovalWrite", () => {
  it("returns stale when snapshot postUpdatedAt mismatches", () => {
    const r = applyCampaignPostPublishApprovalWrite({
      post: post({}),
      campaign: campaignRow({}),
      prevUtm: { bentley_approval_status: "pending_approval" },
      bentleyApprovalStatus: "approved",
      bentleyApprovalReason: null,
      approvalReviewSnapshot: {
        expectedApprovalStatus: "pending_approval",
        postUpdatedAt: "2020-01-01T00:00:00.000Z",
      },
      actor: {
        userId: 9,
        label: "Pat",
        role: "publisher",
        identityBacked: true,
      },
      reviewerRoleForChainGate: "approver",
    });
    expect(r.outcome).toBe("rejected_stale");
  });

  it("merges approved from pending (single-step)", () => {
    const r = applyCampaignPostPublishApprovalWrite({
      post: post({}),
      campaign: campaignRow({}),
      prevUtm: { bentley_approval_status: "pending_approval" },
      bentleyApprovalStatus: "approved",
      bentleyApprovalReason: null,
      approvalReviewSnapshot: {
        expectedApprovalStatus: "pending_approval",
        postUpdatedAt: "2026-01-02T00:00:00.000Z",
      },
      actor: {
        userId: 9,
        label: "Pat",
        role: "publisher",
        identityBacked: true,
      },
      reviewerRoleForChainGate: "approver",
    });
    expect(r.outcome).toBe("accepted_fresh");
    if (r.outcome === "accepted_fresh") {
      expect(r.mergedUtm.bentley_approval_status).toBe("approved");
    }
  });
});
