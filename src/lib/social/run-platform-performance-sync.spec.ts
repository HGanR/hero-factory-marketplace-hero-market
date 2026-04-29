/**
 * @jest-environment node
 */

jest.mock("@/lib/social/sync-platform-post-performance", () => ({
  syncPlatformPostPerformanceForPost: jest.fn(),
}));

jest.mock("@/lib/revenue-os/deployment-feedback-db", () => ({
  attachPerformanceFeedbackToCampaignPost: jest.fn(),
}));

import { runPlatformPerformanceSync } from "@/lib/social/run-platform-performance-sync";
import { syncPlatformPostPerformanceForPost } from "@/lib/social/sync-platform-post-performance";
import { attachPerformanceFeedbackToCampaignPost } from "@/lib/revenue-os/deployment-feedback-db";
import { normalizePerformanceSnapshotToFeedback } from "@/lib/revenue-os/deployment-feedback-contract";

const syncMock = syncPlatformPostPerformanceForPost as jest.MockedFunction<
  typeof syncPlatformPostPerformanceForPost
>;
const attachMock = attachPerformanceFeedbackToCampaignPost as jest.MockedFunction<
  typeof attachPerformanceFeedbackToCampaignPost
>;

function mockDbWithPosts(postIds: string[]) {
  return {
    select: () => ({
      from: () => ({
        innerJoin: () => ({
          where: () => ({
            orderBy: () => ({
              limit: async () => postIds.map((postId) => ({ postId })),
            }),
          }),
        }),
      }),
    }),
  };
}

describe("runPlatformPerformanceSync", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("persists when sync returns synced", async () => {
    const normalized = normalizePerformanceSnapshotToFeedback({
      campaignPostId: "p1",
      campaignId: "c1",
      platform: "linkedin",
      source: "platform_sync",
      impressions: 50,
    });
    syncMock.mockResolvedValue({
      status: "synced",
      campaignPostId: "p1",
      userId: "u1",
      normalized,
    });
    attachMock.mockResolvedValue("row-id");

    const summary = await runPlatformPerformanceSync(mockDbWithPosts(["p1"]) as never, { limit: 5 });
    expect(summary.scanned).toBe(1);
    expect(summary.synced).toBe(1);
    expect(attachMock).toHaveBeenCalledTimes(1);
  });

  it("does not attach when platform returns unsupported", async () => {
    syncMock.mockResolvedValue({
      status: "unsupported",
      campaignPostId: "p1",
      platform: "linkedin",
      reason: "stub",
    });

    const summary = await runPlatformPerformanceSync(mockDbWithPosts(["p1"]) as never, { limit: 5 });
    expect(summary.unsupported).toBe(1);
    expect(attachMock).not.toHaveBeenCalled();
  });

  it("mixed batch: can sync both Instagram and LinkedIn posts when adapter returns synced", async () => {
    syncMock
      .mockResolvedValueOnce({
        status: "synced",
        campaignPostId: "ig",
        userId: "u1",
        normalized: normalizePerformanceSnapshotToFeedback({
          campaignPostId: "ig",
          campaignId: "c1",
          platform: "instagram",
          source: "platform_sync",
          impressions: 50,
        }),
      })
      .mockResolvedValueOnce({
        status: "synced",
        campaignPostId: "li",
        userId: "u1",
        normalized: normalizePerformanceSnapshotToFeedback({
          campaignPostId: "li",
          campaignId: "c1",
          platform: "linkedin",
          source: "platform_sync",
          engagement: 4,
        }),
      });
    attachMock.mockResolvedValue("row");

    const summary = await runPlatformPerformanceSync(mockDbWithPosts(["ig", "li"]) as never, { limit: 5 });
    expect(summary.scanned).toBe(2);
    expect(summary.synced).toBe(2);
    expect(attachMock).toHaveBeenCalledTimes(2);
  });

  it("counts failure when sync throws without poisoning later posts", async () => {
    const db = mockDbWithPosts(["p1", "p2", "p3"]);
    syncMock
      .mockResolvedValueOnce({
        status: "synced",
        campaignPostId: "p1",
        userId: "u1",
        normalized: normalizePerformanceSnapshotToFeedback({
          campaignPostId: "p1",
          campaignId: "c1",
          platform: "instagram",
          source: "platform_sync",
          impressions: 5,
        }),
      })
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce({
        status: "unsupported",
        campaignPostId: "p3",
        platform: "facebook",
        reason: "none",
      });
    attachMock.mockResolvedValue("row");

    const summary = await runPlatformPerformanceSync(db as never, { limit: 5 });
    expect(summary.scanned).toBe(3);
    expect(summary.synced).toBe(1);
    expect(summary.failed).toBe(1);
    expect(summary.unsupported).toBe(1);
    expect(attachMock).toHaveBeenCalledTimes(1);
  });
});
