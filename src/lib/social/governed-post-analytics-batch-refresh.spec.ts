import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import {
  classifyPublishedGovernedPostForBatchRefresh,
  planCampaignGovernedPostAnalyticsBatchRefresh,
  sortPublishedGovernedPostsForBatchRefresh,
  runCampaignGovernedPostAnalyticsBatchRefresh,
  insertGovernedPostAnalyticsBatchRefreshAudit,
  MAX_CAMPAIGN_ANALYTICS_BATCH_LIMIT,
} from "@/lib/social/governed-post-analytics-batch-refresh";
import type { PostRowBatchFields } from "@/lib/social/governed-post-analytics-batch-refresh";

jest.mock("@/lib/social/governed-post-analytics-refresh", () => ({
  refreshGovernedPostAnalytics: jest.fn(),
}));

import { refreshGovernedPostAnalytics } from "@/lib/social/governed-post-analytics-refresh";

function row(p: Partial<PostRowBatchFields> & { id: string }): PostRowBatchFields {
  return {
    id: p.id,
    status: p.status ?? "POSTED",
    platform: p.platform ?? "linkedin",
    platformPostId: p.platformPostId === undefined ? "urn:x" : p.platformPostId,
    postedAt: p.postedAt ?? new Date("2026-03-01T00:00:00.000Z"),
    createdAt: p.createdAt ?? new Date("2026-02-01T00:00:00.000Z"),
  };
}

describe("planCampaignGovernedPostAnalyticsBatchRefresh", () => {
  it("skips unpublished governed posts", () => {
    const plan = planCampaignGovernedPostAnalyticsBatchRefresh({
      posts: [
        row({ id: "a", status: "DRAFT", platform: "linkedin" }),
        row({ id: "b", status: "POSTED", platform: "linkedin", platformPostId: "urn:b" }),
      ],
      limit: 10,
    });
    expect(plan.skippedBreakdown.unpublished).toBe(1);
    expect(plan.postIdsToAttempt).toContain("b");
  });

  it("skips Facebook published rows (no live adapter)", () => {
    const plan = planCampaignGovernedPostAnalyticsBatchRefresh({
      posts: [row({ id: "f", platform: "facebook", platformPostId: "123" })],
      limit: 10,
    });
    expect(plan.postIdsToAttempt).toHaveLength(0);
    expect(plan.skippedBreakdown.unsupported_provider).toBeGreaterThanOrEqual(1);
  });

  it("skips missing platform_post_id", () => {
    const plan = planCampaignGovernedPostAnalyticsBatchRefresh({
      posts: [row({ id: "m", platform: "linkedin", platformPostId: null })],
      limit: 10,
    });
    expect(plan.postIdsToAttempt).toHaveLength(0);
    expect(plan.skippedBreakdown.missing_remote_post_id).toBe(1);
  });

  it("orders oldest posted first and defers past limit", () => {
    const plan = planCampaignGovernedPostAnalyticsBatchRefresh({
      posts: [
        row({ id: "new", postedAt: new Date("2026-06-02T00:00:00.000Z"), platformPostId: "urn:n" }),
        row({ id: "old", postedAt: new Date("2026-06-01T00:00:00.000Z"), platformPostId: "urn:o" }),
      ],
      limit: 1,
    });
    expect(plan.postIdsToAttempt).toEqual(["old"]);
    expect(plan.skippedBreakdown.deferred_due_to_batch_limit).toBe(1);
  });

  it("clamps limit to max", () => {
    const many = Array.from({ length: 60 }, (_, i) =>
      row({
        id: `p-${i}`,
        postedAt: new Date(Date.UTC(2026, 0, i + 1)),
        platformPostId: `urn:${i}`,
      })
    );
    const plan = planCampaignGovernedPostAnalyticsBatchRefresh({
      posts: many,
      limit: 999,
    });
    expect(plan.postIdsToAttempt.length).toBe(MAX_CAMPAIGN_ANALYTICS_BATCH_LIMIT);
    expect(plan.skippedBreakdown.deferred_due_to_batch_limit).toBe(60 - MAX_CAMPAIGN_ANALYTICS_BATCH_LIMIT);
  });
});

describe("sortPublishedGovernedPostsForBatchRefresh", () => {
  it("sorts by postedAt then createdAt", () => {
    const sorted = sortPublishedGovernedPostsForBatchRefresh([
      row({ id: "b", postedAt: new Date("2026-01-02T00:00:00.000Z") }),
      row({
        id: "a",
        postedAt: new Date("2026-01-01T00:00:00.000Z"),
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      }),
      row({
        id: "c",
        postedAt: new Date("2026-01-01T00:00:00.000Z"),
        createdAt: new Date("2026-01-02T00:00:00.000Z"),
      }),
    ]);
    expect(sorted.map((x) => x.id)).toEqual(["a", "c", "b"]);
  });
});

describe("classifyPublishedGovernedPostForBatchRefresh", () => {
  it("eligible for linkedin with id", () => {
    expect(classifyPublishedGovernedPostForBatchRefresh(row({ id: "x" })).kind).toBe("eligible");
  });
});

describe("runCampaignGovernedPostAnalyticsBatchRefresh", () => {
  beforeEach(() => {
    jest.mocked(refreshGovernedPostAnalytics).mockReset();
  });

  it("counts succeeded and failed per post", async () => {
    jest
      .mocked(refreshGovernedPostAnalytics)
      .mockResolvedValueOnce({ ok: true, snapshot: {} as never })
      .mockResolvedValueOnce({ ok: false, code: "fetch_error", message: "nope" });

    const db = {
      select: jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([
            row({ id: "a", postedAt: new Date("2026-01-01T00:00:00.000Z") }),
            row({ id: "b", postedAt: new Date("2026-01-02T00:00:00.000Z") }),
          ]),
        }),
      }),
    };

    const r = await runCampaignGovernedPostAnalyticsBatchRefresh({
      db: db as never,
      userId: "1",
      campaignId: "11111111-1111-4111-8111-111111111111",
      limit: 10,
    });

    expect(r.attemptedCount).toBe(2);
    expect(r.succeededCount).toBe(1);
    expect(r.failedCount).toBe(1);
    expect(r.failures).toHaveLength(1);
    expect(r.failures[0]?.code).toBe("fetch_error");
  });
});

describe("insertGovernedPostAnalyticsBatchRefreshAudit", () => {
  it("inserts one row with null post id", async () => {
    const values = jest.fn().mockResolvedValue(undefined);
    const db = {
      insert: jest.fn().mockReturnValue({ values }),
    } as unknown as import("@/lib/social/social-post-audit-query").SocialPostTimelineDb;
    await insertGovernedPostAnalyticsBatchRefreshAudit({
      db,
      userId: "9",
      details: { campaignId: "c1", attemptedCount: 0 },
    });
    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        postId: null,
        userId: "9",
        action: "governed_post_analytics_batch_refreshed",
        platform: "governed_social",
      })
    );
  });
});
