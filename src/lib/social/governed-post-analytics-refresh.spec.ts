import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import { refreshGovernedPostAnalytics } from "@/lib/social/governed-post-analytics-refresh";
import * as publish from "@/lib/social/campaign-post-publish";
import * as adapters from "@/lib/social/platform-performance-adapters";
import * as store from "@/lib/social/governed-post-analytics-store";

jest.spyOn(publish, "loadCampaignPostPublishContext");
jest.spyOn(adapters, "fetchPlatformPostPerformanceSnapshot");
jest.spyOn(store, "insertCampaignPostAnalyticsSnapshot");

describe("refreshGovernedPostAnalytics", () => {
  const db = { insert: () => ({ values: jest.fn(async () => {}) }) } as unknown as Parameters<
    typeof refreshGovernedPostAnalytics
  >[0]["db"];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns not_published when row is not POSTED", async () => {
    (publish.loadCampaignPostPublishContext as jest.Mock).mockResolvedValue({
      post: {
        id: "p1",
        status: "SCHEDULED",
        platform: "linkedin",
        platformPostId: "urn:li:ugcPost:1",
        campaignId: "c1",
      },
      platformKey: "linkedin",
      accessToken: "t",
    });
    const r = await refreshGovernedPostAnalytics({ db, userId: "u1", postId: "p1" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("not_published");
    expect(store.insertCampaignPostAnalyticsSnapshot).not.toHaveBeenCalled();
  });

  it("persists snapshot on successful fetch", async () => {
    (publish.loadCampaignPostPublishContext as jest.Mock).mockResolvedValue({
      post: {
        id: "p1",
        status: "POSTED",
        platform: "linkedin",
        platformPostId: "urn:li:ugcPost:1",
        campaignId: "c1",
      },
      platformKey: "linkedin",
      accessToken: "t",
    });
    (adapters.fetchPlatformPostPerformanceSnapshot as jest.Mock).mockResolvedValue({
      status: "ok",
      snapshot: {
        platform: "linkedin",
        externalPostId: "urn:li:ugcPost:1",
        capturedAt: "2026-04-08T00:00:00.000Z",
        likes: 1,
        comments: 2,
        engagement: 3,
      },
    });

    const r = await refreshGovernedPostAnalytics({ db, userId: "u1", postId: "p1" });
    expect(r.ok).toBe(true);
    expect(store.insertCampaignPostAnalyticsSnapshot).toHaveBeenCalledTimes(1);
  });
});
