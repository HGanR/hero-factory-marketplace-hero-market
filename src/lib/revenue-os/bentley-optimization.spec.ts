/**
 * @jest-environment node
 */
import { describe, it, expect } from "@jest/globals";
import type { CampaignGovernedSocialAnalyticsPayload } from "@/lib/social/governed-post-analytics-aggregate";
import { runBentleyOptimizationDiagnosis } from "@/lib/revenue-os/bentley-optimization";

function baseAggregate(
  overrides: Partial<CampaignGovernedSocialAnalyticsPayload> = {}
): CampaignGovernedSocialAnalyticsPayload {
  return {
    campaignId: "c1",
    campaignSummary: {
      governedPostCount: 2,
      publishedPostCount: 2,
      postsWithLatestSnapshot: 2,
      postsPublishedNeverSynced: 0,
      postsMissingRemotePostId: 0,
      postsUnsupportedForLiveSync: 0,
    },
    aggregateMetrics: {},
    providerSummaries: [],
    coverage: {
      code: "all_published_synced",
      headline: "ok",
      notes: [],
    },
    freshness: { freshestSnapshotAt: new Date().toISOString(), stalestSnapshotAt: new Date().toISOString() },
    liveAdapterProviders: ["instagram"],
    ...overrides,
  };
}

describe("runBentleyOptimizationDiagnosis", () => {
  it("diagnoses engagement when impressions exist and engagement rate is weak", () => {
    const aggregate = baseAggregate({
      aggregateMetrics: {
        impressions: { sum: 5000, posts: 2 },
        reactions: { sum: 10, posts: 2 },
        comments: { sum: 5, posts: 2 },
        shares: { sum: 0, posts: 0 },
      },
    });
    const r = runBentleyOptimizationDiagnosis({
      aggregate,
      postCounts: { failed: 0, scheduledOrDraft: 0, posted: 2 },
      approval: { pendingApprovalCount: 0, overdueApprovalCount: 0 },
    });
    expect(r.status).toBe("ready");
    expect(r.primaryDriver).toBe("engagement");
    expect(r.findings.some((f) => f.code === "weak_engagement_rate")).toBe(true);
  });

  it("diagnoses conversion path when CTR is weak vs impressions", () => {
    const aggregate = baseAggregate({
      aggregateMetrics: {
        impressions: { sum: 10000, posts: 2 },
        clicks: { sum: 10, posts: 2 },
        reactions: { sum: 200, posts: 2 },
      },
    });
    const r = runBentleyOptimizationDiagnosis({
      aggregate,
      postCounts: { failed: 0, scheduledOrDraft: 0, posted: 2 },
      approval: { pendingApprovalCount: 0, overdueApprovalCount: 0 },
    });
    expect(r.primaryDriver).toBe("conversion");
    expect(r.findings.some((f) => f.code === "weak_click_through")).toBe(true);
  });

  it("prioritizes publish friction when FAILED posts exist", () => {
    const aggregate = baseAggregate({
      aggregateMetrics: {
        impressions: { sum: 5000, posts: 2 },
      },
    });
    const r = runBentleyOptimizationDiagnosis({
      aggregate,
      postCounts: { failed: 2, scheduledOrDraft: 0, posted: 2 },
      approval: { pendingApprovalCount: 0, overdueApprovalCount: 0 },
    });
    expect(r.primaryDriver).toBe("publish_friction");
    expect(r.findings.some((f) => f.code === "publish_failures_present")).toBe(true);
  });

  it("returns insufficient_data when not enough synced posts", () => {
    const aggregate = baseAggregate({
      campaignSummary: {
        governedPostCount: 2,
        publishedPostCount: 2,
        postsWithLatestSnapshot: 1,
        postsPublishedNeverSynced: 0,
        postsMissingRemotePostId: 0,
        postsUnsupportedForLiveSync: 0,
      },
    });
    const r = runBentleyOptimizationDiagnosis({
      aggregate,
      postCounts: { failed: 0, scheduledOrDraft: 0, posted: 2 },
      approval: { pendingApprovalCount: 0, overdueApprovalCount: 0 },
    });
    expect(r.status).toBe("insufficient_data");
  });

  it("blocks when analytics never synced", () => {
    const aggregate = baseAggregate({
      coverage: {
        code: "published_none_synced",
        headline: "x",
        notes: [],
      },
      campaignSummary: {
        governedPostCount: 2,
        publishedPostCount: 2,
        postsWithLatestSnapshot: 0,
        postsPublishedNeverSynced: 2,
        postsMissingRemotePostId: 0,
        postsUnsupportedForLiveSync: 0,
      },
    });
    const r = runBentleyOptimizationDiagnosis({
      aggregate,
      postCounts: { failed: 0, scheduledOrDraft: 0, posted: 2 },
      approval: { pendingApprovalCount: 0, overdueApprovalCount: 0 },
    });
    expect(r.status).toBe("blocked");
    expect(r.findings.some((f) => f.code === "analytics_not_synced")).toBe(true);
  });

  it("warns when prior variant underperformed on the same primary driver", () => {
    const aggregate = baseAggregate({
      aggregateMetrics: {
        impressions: { sum: 5000, posts: 2 },
        reactions: { sum: 10, posts: 2 },
        comments: { sum: 5, posts: 2 },
        shares: { sum: 0, posts: 0 },
      },
    });
    const r = runBentleyOptimizationDiagnosis({
      aggregate,
      postCounts: { failed: 0, scheduledOrDraft: 0, posted: 2 },
      approval: { pendingApprovalCount: 0, overdueApprovalCount: 0 },
      priorHints: {
        losingPrimaryDrivers: ["engagement"],
        winningPrimaryDrivers: [],
      },
    });
    expect(r.status).toBe("ready");
    expect(r.primaryDriver).toBe("engagement");
    expect(r.findings.some((f) => f.code === "prior_variant_underperformed_same_driver")).toBe(true);
  });
});

describe("buildBentleyOptimizationVariantDraft", () => {
  it("preserves lineage note with parent and run id", async () => {
    const { buildBentleyOptimizationVariantDraft } = await import("@/lib/revenue-os/bentley-optimization-variants");
    const { runBentleyOptimizationDiagnosis } = await import("@/lib/revenue-os/bentley-optimization");
    const agg = baseAggregate({
      aggregateMetrics: {
        impressions: { sum: 5000, posts: 2 },
        reactions: { sum: 10, posts: 2 },
        comments: { sum: 5, posts: 2 },
      },
    });
    const result = runBentleyOptimizationDiagnosis({
      aggregate: agg,
      postCounts: { failed: 0, scheduledOrDraft: 0, posted: 2 },
      approval: { pendingApprovalCount: 0, overdueApprovalCount: 0 },
    });
    const draft = buildBentleyOptimizationVariantDraft({
      parentCampaignId: "parent-uuid",
      optimizationRunId: "run-uuid",
      campaign: {
        offerStatement: "Test offer",
        shortFormHooks: ["Hook1"],
        industry: "X",
        targetAudience: "Y",
        messagePillars: [],
        longFormOutlines: [],
        objectionReplies: [],
      },
      result,
    });
    expect(draft.lineageNote).toContain("parent-uuid");
    expect(draft.lineageNote).toContain("run-uuid");
    expect(draft.captionHooksSuggested.length).toBeGreaterThan(0);
  });
});
