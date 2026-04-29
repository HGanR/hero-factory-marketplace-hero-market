/**
 * @jest-environment node
 */
import { describe, it, expect } from "@jest/globals";
import { evaluateBentleyOptimizationAutoExecuteGates } from "@/lib/revenue-os/bentley-optimization-auto-execute";

describe("evaluateBentleyOptimizationAutoExecuteGates", () => {
  const baseResult = {
    status: "ready" as const,
    primaryDriver: "engagement" as const,
    findings: [],
    recommendations: [],
    variantOpportunities: [],
    confidence: "medium" as const,
    metricsEcho: {
      publishedPostCount: 2,
      postsWithLatestSnapshot: 2,
      aggregateImpressionsSum: 1000,
      aggregateClicksSum: 10,
      engagementNumerator: 20,
      failedPostCount: 0,
      pendingApprovalCount: 0,
      overdueApprovalCount: 0,
      coverageCode: "all_published_synced",
    },
  };

  it("allows when confidence is medium and parent has posts and no friction", () => {
    const r = evaluateBentleyOptimizationAutoExecuteGates({
      result: baseResult,
      parentCampaignPostCount: 2,
      postCounts: { failed: 0 },
      approval: { pendingApprovalCount: 0, overdueApprovalCount: 0 },
    });
    expect(r.allowed).toBe(true);
    expect(r.reasons).toHaveLength(0);
  });

  it("blocks low confidence", () => {
    const r = evaluateBentleyOptimizationAutoExecuteGates({
      result: { ...baseResult, confidence: "low" },
      parentCampaignPostCount: 2,
      postCounts: { failed: 0 },
      approval: { pendingApprovalCount: 0, overdueApprovalCount: 0 },
    });
    expect(r.allowed).toBe(false);
    expect(r.reasons).toContain("confidence_below_medium");
  });

  it("blocks when parent has no campaign_posts yet", () => {
    const r = evaluateBentleyOptimizationAutoExecuteGates({
      result: baseResult,
      parentCampaignPostCount: 0,
      postCounts: { failed: 0 },
      approval: { pendingApprovalCount: 0, overdueApprovalCount: 0 },
    });
    expect(r.allowed).toBe(false);
    expect(r.reasons).toContain("parent_launch_not_materialized");
  });
});
