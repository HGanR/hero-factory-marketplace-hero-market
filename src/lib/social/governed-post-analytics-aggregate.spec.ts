import { describe, it, expect } from "@jest/globals";
import { computeCampaignGovernedSocialAnalyticsRollup } from "@/lib/social/governed-post-analytics-aggregate";
import { SOCIAL_POST_ANALYTICS_PAYLOAD_VERSION } from "@/lib/social/governed-post-analytics-types";

function payload(normalized: Record<string, number>) {
  return {
    version: SOCIAL_POST_ANALYTICS_PAYLOAD_VERSION,
    normalized,
    platformSnapshot: { platform: "linkedin", externalPostId: "x", capturedAt: "2026-01-01T00:00:00.000Z" },
    sourceNotes: [],
  };
}

describe("computeCampaignGovernedSocialAnalyticsRollup", () => {
  it("uses latest snapshot per post only (single row per id in map)", () => {
    const map = new Map([
      [
        "a",
        {
          fetchedAt: new Date("2026-06-01T12:00:00.000Z"),
          metricsJson: payload({ impressions: 100, engagementsTotal: 5 }),
        },
      ],
      [
        "b",
        {
          fetchedAt: new Date("2026-06-02T12:00:00.000Z"),
          metricsJson: payload({ impressions: 50 }),
        },
      ],
    ]);
    const r = computeCampaignGovernedSocialAnalyticsRollup({
      posts: [
        { id: "a", status: "POSTED", platform: "linkedin", platformPostId: "urn:1" },
        { id: "b", status: "POSTED", platform: "linkedin", platformPostId: "urn:2" },
      ],
      latestSnapshotByPostId: map,
    });
    expect(r.campaignSummary.publishedPostCount).toBe(2);
    expect(r.campaignSummary.postsWithLatestSnapshot).toBe(2);
    expect(r.aggregateMetrics.impressions?.sum).toBe(150);
    expect(r.aggregateMetrics.impressions?.posts).toBe(2);
    expect(r.aggregateMetrics.engagementsTotal?.sum).toBe(5);
    expect(r.aggregateMetrics.engagementsTotal?.posts).toBe(1);
    expect(r.freshness.freshestSnapshotAt).toBe("2026-06-02T12:00:00.000Z");
    expect(r.freshness.stalestSnapshotAt).toBe("2026-06-01T12:00:00.000Z");
  });

  it("counts published never synced for live adapter + remote id + no snapshot", () => {
    const r = computeCampaignGovernedSocialAnalyticsRollup({
      posts: [{ id: "x", status: "POSTED", platform: "instagram", platformPostId: "99" }],
      latestSnapshotByPostId: new Map(),
    });
    expect(r.campaignSummary.postsPublishedNeverSynced).toBe(1);
    expect(r.coverage.code).toBe("published_none_synced");
  });

  it("marks unsupported_only when only no-adapter providers are published", () => {
    const r = computeCampaignGovernedSocialAnalyticsRollup({
      posts: [{ id: "f", status: "POSTED", platform: "facebook", platformPostId: "123" }],
      latestSnapshotByPostId: new Map(),
    });
    expect(r.coverage.code).toBe("unsupported_only");
    expect(r.providerSummaries[0]?.metricSyncSupport).toBe("no_adapter");
  });

  it("provider summaries split metrics by platform", () => {
    const map = new Map([
      [
        "i1",
        {
          fetchedAt: new Date("2026-01-03T00:00:00.000Z"),
          metricsJson: payload({ impressions: 10 }),
        },
      ],
      [
        "l1",
        {
          fetchedAt: new Date("2026-01-03T01:00:00.000Z"),
          metricsJson: payload({ impressions: 3, engagementsTotal: 2 }),
        },
      ],
    ]);
    const r = computeCampaignGovernedSocialAnalyticsRollup({
      posts: [
        { id: "i1", status: "POSTED", platform: "instagram", platformPostId: "1" },
        { id: "l1", status: "POSTED", platform: "linkedin", platformPostId: "urn:x" },
      ],
      latestSnapshotByPostId: map,
    });
    const ig = r.providerSummaries.find((s) => s.provider === "instagram");
    const li = r.providerSummaries.find((s) => s.provider === "linkedin");
    expect(ig?.postsWithLatestSnapshot).toBe(1);
    expect(li?.postsWithLatestSnapshot).toBe(1);
    expect(ig?.metrics.impressions?.sum).toBe(10);
    expect(li?.metrics.engagementsTotal?.sum).toBe(2);
  });

  it("no published posts uses no_published_posts coverage", () => {
    const r = computeCampaignGovernedSocialAnalyticsRollup({
      posts: [{ id: "d", status: "DRAFT", platform: "linkedin", platformPostId: null }],
      latestSnapshotByPostId: new Map(),
    });
    expect(r.campaignSummary.publishedPostCount).toBe(0);
    expect(r.coverage.code).toBe("no_published_posts");
  });
});
