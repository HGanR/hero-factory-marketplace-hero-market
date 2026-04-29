/**
 * @jest-environment node
 */
import {
  normalizePlatformPerformanceSnapshot,
  syncPlatformPostPerformanceForPost,
} from "@/lib/social/sync-platform-post-performance";

describe("normalizePlatformPerformanceSnapshot", () => {
  it("maps snapshot fields including syncedAt and sourcePlatform", () => {
    const f = normalizePlatformPerformanceSnapshot(
      {
        platform: "linkedin",
        capturedAt: "2026-01-01T00:00:00.000Z",
        impressions: 100,
        clicks: 2,
        engagement: 5,
      },
      "linkedin"
    );
    expect(f.impressions).toBe(100);
    expect(f.clicks).toBe(2);
    expect(f.syncedAt).toBe("2026-01-01T00:00:00.000Z");
    expect(f.sourcePlatform).toBe("linkedin");
  });
});

describe("syncPlatformPostPerformanceForPost", () => {
  it("skips when platform_post_id is missing (traceability)", async () => {
    const db = {
      select: () => ({
        from: () => ({
          where: () => ({
            limit: async () => [
              {
                id: "post-1",
                campaignId: "camp-1",
                status: "POSTED",
                platformPostId: null,
                postedAt: new Date("2026-01-01T00:00:00.000Z"),
              },
            ],
          }),
        }),
      }),
    };
    const r = await syncPlatformPostPerformanceForPost(db as never, "post-1");
    expect(r.status).toBe("skipped");
    if (r.status === "skipped") expect(r.reason).toBe("missing_platform_post_id");
  });
});
