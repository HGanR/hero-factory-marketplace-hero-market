import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import {
  sortEligiblePostsForScheduledRefresh,
  selectScheduledAnalyticsRefreshAttempts,
  runScheduledGovernedPostAnalyticsRefresh,
  insertGovernedPostAnalyticsScheduledRefreshAudit,
  resolveScheduledGovernedAnalyticsLimits,
  SCHEDULED_GOVERNED_ANALYTICS_MAX_POSTS_HARD,
  type PostRowScheduledFields,
  type EligiblePostWithFreshness,
} from "@/lib/social/run-scheduled-governed-post-analytics-refresh";

jest.mock("@/lib/social/governed-post-analytics-store", () => ({
  getLatestAnalyticsSnapshotRowsForPostIds: jest.fn(),
}));
jest.mock("@/lib/social/governed-post-analytics-refresh", () => ({
  refreshGovernedPostAnalytics: jest.fn(),
}));

import { getLatestAnalyticsSnapshotRowsForPostIds } from "@/lib/social/governed-post-analytics-store";
import { refreshGovernedPostAnalytics } from "@/lib/social/governed-post-analytics-refresh";

function post(
  id: string,
  campaignId: string,
  partial?: Partial<PostRowScheduledFields>
): PostRowScheduledFields {
  return {
    id,
    campaignId,
    status: "POSTED",
    platform: "linkedin",
    platformPostId: "urn:x",
    postedAt: new Date("2026-06-01T00:00:00.000Z"),
    createdAt: new Date("2026-05-01T00:00:00.000Z"),
    ...partial,
  };
}

describe("sortEligiblePostsForScheduledRefresh", () => {
  it("orders never-synced before posts with snapshots", () => {
    const eligible = [post("b", "c1"), post("a", "c1")];
    const map = new Map<string, Date | null>([
      ["b", new Date("2026-01-01T00:00:00.000Z")],
      ["a", null],
    ]);
    const sorted = sortEligiblePostsForScheduledRefresh(eligible, map);
    expect(sorted.map((x) => x.id)).toEqual(["a", "b"]);
  });

  it("orders stalest snapshot before fresher", () => {
    const eligible = [post("fresh", "c1"), post("stale", "c1")];
    const map = new Map<string, Date | null>([
      ["fresh", new Date("2026-06-10T00:00:00.000Z")],
      ["stale", new Date("2026-01-01T00:00:00.000Z")],
    ]);
    const sorted = sortEligiblePostsForScheduledRefresh(eligible, map);
    expect(sorted.map((x) => x.id)).toEqual(["stale", "fresh"]);
  });
});

describe("selectScheduledAnalyticsRefreshAttempts", () => {
  function el(
    id: string,
    camp: string,
    fetched: Date | null
  ): EligiblePostWithFreshness {
    return { ...post(id, camp), latestFetchedAt: fetched };
  }

  it("respects global max posts", () => {
    const r = selectScheduledAnalyticsRefreshAttempts({
      orderedEligible: [el("1", "a", null), el("2", "a", null), el("3", "a", null)],
      maxPosts: 2,
      maxPostsPerCampaign: 10,
      maxCampaigns: 10,
    });
    expect(r.postIdsToAttempt).toEqual(["1", "2"]);
    expect(r.deferredDueToBatchLimit).toBe(1);
  });

  it("respects per-campaign cap", () => {
    const r = selectScheduledAnalyticsRefreshAttempts({
      orderedEligible: [el("1", "a", null), el("2", "a", null), el("3", "b", null)],
      maxPosts: 10,
      maxPostsPerCampaign: 1,
      maxCampaigns: 10,
    });
    expect(r.postIdsToAttempt).toEqual(["1", "3"]);
    expect(r.deferredDueToCampaignLimit).toBe(1);
  });

  it("respects max distinct campaigns", () => {
    const r = selectScheduledAnalyticsRefreshAttempts({
      orderedEligible: [el("1", "a", null), el("2", "b", null), el("3", "c", null)],
      maxPosts: 10,
      maxPostsPerCampaign: 10,
      maxCampaigns: 2,
    });
    expect(r.postIdsToAttempt).toEqual(["1", "2"]);
    expect(r.deferredDueToMaxCampaigns).toBe(1);
  });
});

describe("runScheduledGovernedPostAnalyticsRefresh", () => {
  beforeEach(() => {
    jest.mocked(getLatestAnalyticsSnapshotRowsForPostIds).mockReset();
    jest.mocked(refreshGovernedPostAnalytics).mockReset();
    jest.mocked(getLatestAnalyticsSnapshotRowsForPostIds).mockResolvedValue(new Map());
    jest.mocked(refreshGovernedPostAnalytics).mockResolvedValue({ ok: true, snapshot: {} as never });
  });

  it("runs refresh for selected posts and writes audit", async () => {
    const pool = [
      {
        id: "p1",
        campaignId: "camp-1",
        status: "POSTED",
        platform: "linkedin",
        platformPostId: "urn:1",
        postedAt: new Date("2026-06-01T00:00:00.000Z"),
        createdAt: new Date("2026-05-01T00:00:00.000Z"),
      },
    ];
    const db = {
      select: jest.fn(() => ({
        from: jest.fn(() => ({
          where: jest.fn(() => ({
            orderBy: jest.fn(() => ({
              limit: jest.fn().mockResolvedValue(pool),
            })),
          })),
        })),
      })),
      insert: jest.fn(() => ({
        values: jest.fn().mockResolvedValue(undefined),
      })),
    } as never;

    const summary = await runScheduledGovernedPostAnalyticsRefresh(db, {
      scanPoolLimit: 50,
      maxPosts: 5,
      maxPostsPerCampaign: 5,
      maxCampaigns: 5,
    });

    expect(summary.attemptedCount).toBe(1);
    expect(summary.succeededCount).toBe(1);
    expect(refreshGovernedPostAnalytics).toHaveBeenCalledWith(
      expect.objectContaining({ postId: "p1" })
    );
    expect(db.insert).toHaveBeenCalled();
  });

  it("pauses provider after repeated throttles and defers remaining same-provider rows; other providers continue", async () => {
    const pool = [
      {
        id: "li_a",
        campaignId: "c1",
        status: "POSTED",
        platform: "linkedin",
        platformPostId: "urn:a",
        postedAt: new Date("2026-06-01T00:00:00.000Z"),
        createdAt: new Date("2026-05-01T00:00:00.000Z"),
      },
      {
        id: "li_b",
        campaignId: "c2",
        status: "POSTED",
        platform: "linkedin",
        platformPostId: "urn:b",
        postedAt: new Date("2026-06-02T00:00:00.000Z"),
        createdAt: new Date("2026-05-01T00:00:00.000Z"),
      },
      {
        id: "ig_a",
        campaignId: "c3",
        status: "POSTED",
        platform: "instagram",
        platformPostId: "ext-ig",
        postedAt: new Date("2026-06-03T00:00:00.000Z"),
        createdAt: new Date("2026-05-01T00:00:00.000Z"),
      },
      {
        id: "li_c",
        campaignId: "c4",
        status: "POSTED",
        platform: "linkedin",
        platformPostId: "urn:c",
        postedAt: new Date("2026-06-04T00:00:00.000Z"),
        createdAt: new Date("2026-05-01T00:00:00.000Z"),
      },
    ];
    const db = {
      select: jest.fn(() => ({
        from: jest.fn(() => ({
          where: jest.fn(() => ({
            orderBy: jest.fn(() => ({
              limit: jest.fn().mockResolvedValue(pool),
            })),
          })),
        })),
      })),
      insert: jest.fn(() => ({
        values: jest.fn().mockResolvedValue(undefined),
      })),
    } as never;

    jest.mocked(refreshGovernedPostAnalytics).mockImplementation(async (args: { postId: string }) => {
      if (args.postId === "li_a" || args.postId === "li_b") {
        return { ok: false, code: "fetch_error", message: "HTTP 429 Too Many Requests" };
      }
      return { ok: true, snapshot: {} as never };
    });

    const summary = await runScheduledGovernedPostAnalyticsRefresh(db, {
      scanPoolLimit: 50,
      maxPosts: 20,
      maxPostsPerCampaign: 10,
      maxCampaigns: 20,
      maxPerProvider: 10,
      throttlePauseAfter: 2,
    });

    expect(summary.attemptedCount).toBe(3);
    expect(summary.succeededCount).toBe(1);
    expect(summary.failedCount).toBe(2);
    expect(summary.throttledCount).toBe(2);
    expect(summary.deferredDueToProviderBackoff).toBe(1);
    expect(jest.mocked(refreshGovernedPostAnalytics).mock.calls.map((c) => c[0].postId)).toEqual([
      "li_a",
      "li_b",
      "ig_a",
    ]);
  });

  it("defers further same-provider rows when maxPerProvider is reached", async () => {
    const pool = [
      {
        id: "li_a",
        campaignId: "c1",
        status: "POSTED",
        platform: "linkedin",
        platformPostId: "urn:a",
        postedAt: new Date("2026-06-01T00:00:00.000Z"),
        createdAt: new Date("2026-05-01T00:00:00.000Z"),
      },
      {
        id: "li_b",
        campaignId: "c2",
        status: "POSTED",
        platform: "linkedin",
        platformPostId: "urn:b",
        postedAt: new Date("2026-06-02T00:00:00.000Z"),
        createdAt: new Date("2026-05-01T00:00:00.000Z"),
      },
    ];
    const db = {
      select: jest.fn(() => ({
        from: jest.fn(() => ({
          where: jest.fn(() => ({
            orderBy: jest.fn(() => ({
              limit: jest.fn().mockResolvedValue(pool),
            })),
          })),
        })),
      })),
      insert: jest.fn(() => ({
        values: jest.fn().mockResolvedValue(undefined),
      })),
    } as never;

    const summary = await runScheduledGovernedPostAnalyticsRefresh(db, {
      scanPoolLimit: 50,
      maxPosts: 10,
      maxPostsPerCampaign: 10,
      maxCampaigns: 10,
      maxPerProvider: 1,
      throttlePauseAfter: 5,
    });

    expect(summary.attemptedCount).toBe(1);
    expect(summary.deferredDueToPerProviderCap).toBe(1);
    expect(summary.deferredDueToProviderBackoff).toBe(0);
  });
});

describe("resolveScheduledGovernedAnalyticsLimits", () => {
  const SCHED_ENV_KEYS = [
    "SCHEDULED_GOVERNED_ANALYTICS_SCAN_POOL_LIMIT",
    "SCHEDULED_GOVERNED_ANALYTICS_MAX_POSTS",
    "SCHEDULED_GOVERNED_ANALYTICS_MAX_POSTS_PER_CAMPAIGN",
    "SCHEDULED_GOVERNED_ANALYTICS_MAX_CAMPAIGNS",
    "SCHEDULED_GOVERNED_ANALYTICS_MAX_PER_PROVIDER",
    "SCHEDULED_GOVERNED_ANALYTICS_PROVIDER_THROTTLE_PAUSE_AFTER",
  ] as const;

  let backup: Record<string, string | undefined> = {};

  beforeEach(() => {
    backup = {};
    for (const k of SCHED_ENV_KEYS) {
      backup[k] = process.env[k];
      delete process.env[k];
    }
  });

  afterEach(() => {
    for (const k of SCHED_ENV_KEYS) {
      if (backup[k] === undefined) delete process.env[k];
      else process.env[k] = backup[k];
    }
  });

  it("clamps env max posts to hard ceiling", () => {
    process.env.SCHEDULED_GOVERNED_ANALYTICS_MAX_POSTS = "99999";
    const L = resolveScheduledGovernedAnalyticsLimits();
    expect(L.maxPosts).toBe(SCHEDULED_GOVERNED_ANALYTICS_MAX_POSTS_HARD);
  });

  it("uses defaults when env is unset", () => {
    const L = resolveScheduledGovernedAnalyticsLimits();
    expect(L.maxPerProvider).toBeGreaterThan(0);
    expect(L.throttlePauseAfter).toBeGreaterThanOrEqual(1);
  });
});

describe("insertGovernedPostAnalyticsScheduledRefreshAudit", () => {
  it("writes governed_post_analytics_scheduled_refresh_ran", async () => {
    const values = jest.fn().mockResolvedValue(undefined);
    const db = {
      insert: jest.fn().mockReturnValue({ values }),
    } as unknown as import("@/lib/social/social-post-audit-query").SocialPostTimelineDb;
    await insertGovernedPostAnalyticsScheduledRefreshAudit({
      db,
      userId: "0",
      details: { source: "scheduled" },
    });
    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "governed_post_analytics_scheduled_refresh_ran",
        postId: null,
        platform: "governed_social",
      })
    );
  });
});
