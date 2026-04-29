import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { mapCampaignPostRowToSocialGovernedPublic } from "@/lib/social/social-governed-post-public";
import type { campaignPosts } from "@/lib/db/schema";

describe("mapCampaignPostRowToSocialGovernedPublic", () => {
  const prev = process.env.BENTLEY_SCHEDULED_PUBLISH_REQUIRE_APPROVAL;

  afterEach(() => {
    process.env.BENTLEY_SCHEDULED_PUBLISH_REQUIRE_APPROVAL = prev;
  });

  it("maps scheduled row with pending approval under worker gate", () => {
    process.env.BENTLEY_SCHEDULED_PUBLISH_REQUIRE_APPROVAL = "1";
    const row = {
      id: "p1",
      campaignId: "c1",
      platform: "linkedin",
      socialAccountId: null,
      caption: "Hello world",
      linkUrl: null,
      scheduledAt: new Date("2026-06-01T15:00:00.000Z"),
      status: "SCHEDULED",
      utmParams: {},
      platformPostId: null,
      errorMessage: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      assetId: null,
      hashtags: null,
      scheduledPublishMeta: null,
    } as typeof campaignPosts.$inferSelect;

    const pub = mapCampaignPostRowToSocialGovernedPublic(row);
    expect(pub.publishStatus).toBe("scheduled");
    expect(pub.approvalStatus).toBe("pending_approval");
    expect(pub.assetId).toBeNull();
    expect(pub.assetCreativeType).toBeNull();
  });

  it("maps approved scheduled row as eligible label", () => {
    process.env.BENTLEY_SCHEDULED_PUBLISH_REQUIRE_APPROVAL = "1";
    const row = {
      id: "p2",
      campaignId: "c1",
      platform: "linkedin",
      socialAccountId: "acc1",
      caption: "X",
      linkUrl: null,
      scheduledAt: new Date("2026-06-01T15:00:00.000Z"),
      status: "SCHEDULED",
      utmParams: { bentley_approval_status: "approved" },
      platformPostId: null,
      errorMessage: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      assetId: null,
      hashtags: null,
      scheduledPublishMeta: null,
    } as typeof campaignPosts.$inferSelect;

    const pub = mapCampaignPostRowToSocialGovernedPublic(row);
    expect(pub.approvalStatus).toBe("approved");
    expect(pub.publishStatus).toBe("scheduled");
  });
});
