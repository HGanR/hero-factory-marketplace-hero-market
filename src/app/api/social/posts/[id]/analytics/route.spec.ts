import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import { NextRequest } from "next/server";
import { GET } from "./route";

jest.mock("@/lib/revenue-os-api-access", () => ({
  enforceRevenueOsApiAccess: jest.fn(async () => null),
}));

jest.mock("@/lib/api/auth", () => ({
  getAuthedUserId: jest.fn(async () => "user-1"),
}));

const selectMock = jest.fn();
jest.mock("@/lib/db", () => ({
  getDb: jest.fn(async () => ({
    select: () => ({ from: () => ({ where: () => ({ limit: () => selectMock() }) }) }),
  })),
}));

jest.mock("@/lib/revenue-os/get-campaign-reviewer-access", () => ({
  getCampaignReviewerAccess: jest.fn(async () => ({ campaign: { id: "c1", clientId: "cl1", userId: "owner" }, reviewerRole: "owner" })),
}));

jest.mock("@/lib/social/governed-post-analytics-public", () => ({
  buildSocialPostAnalyticsPublic: jest.fn(async () => ({
    availability: { code: "ready", message: "ok" },
    metricSyncSupport: "live",
    latest: null,
    recentSnapshots: [],
  })),
}));

describe("GET /api/social/posts/[id]/analytics", () => {
  beforeEach(() => {
    selectMock.mockReset();
  });

  it("returns analytics envelope", async () => {
    selectMock.mockResolvedValueOnce([
      {
        id: "p1",
        campaignId: "c1",
        platform: "linkedin",
        status: "POSTED",
        platformPostId: "urn:li:ugcPost:1",
        caption: "",
        hashtags: null,
        linkUrl: null,
        utmParams: {},
        scheduledPublishMeta: null,
        errorMessage: null,
        socialAccountId: null,
        assetId: null,
        scheduledAt: null,
        postedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
    const req = new NextRequest("http://localhost/api/social/posts/p1/analytics");
    const res = await GET(req, { params: Promise.resolve({ id: "p1" }) });
    expect(res.status).toBe(200);
    const j = (await res.json()) as { analytics: { availability: { code: string } } };
    expect(j.analytics.availability.code).toBe("ready");
  });
});
