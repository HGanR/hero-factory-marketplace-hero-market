import { buildDeploymentFeedbackSignalsInput, rowToNormalized } from "@/lib/revenue-os/deployment-feedback-db";
import type { RevenueOsDeploymentFeedbackRow } from "@/lib/db/schema";
import {
  normalizePerformanceSnapshotToFeedback,
  normalizePublishOutcomeToFeedback,
} from "@/lib/revenue-os/deployment-feedback-contract";
import { enrichSystemSignalsFromFeedback } from "@/lib/revenue-os/derive-system-signals-from-feedback";
import type { RevenueOsSystemSignals } from "@/lib/revenue-os/revenue-os-system-signals-types";

describe("deployment-feedback-db helpers", () => {
  it("rowToNormalized parses feedback_json", () => {
    const n = normalizePublishOutcomeToFeedback({
      campaignPostId: "p1",
      campaignId: "c1",
      platform: "linkedin",
      outcome: "published",
      source: "manual_publish",
    });
    const row = {
      feedbackJson: n,
      feedbackRowKind: "publish_outcome",
    } as unknown as RevenueOsDeploymentFeedbackRow;
    const parsed = rowToNormalized(row);
    expect(parsed?.campaignPostId).toBe("p1");
    expect(parsed?.publishStatus).toBe("published");
    expect(parsed?.feedbackRowKind).toBe("publish_outcome");
  });

  it("rowToNormalized prefers DB feedback_row_kind over JSON", () => {
    const n = normalizePerformanceSnapshotToFeedback({
      campaignPostId: "p2",
      campaignId: "c1",
      platform: "linkedin",
      source: "platform_sync",
      impressions: 10,
    });
    const row = {
      feedbackJson: n,
      feedbackRowKind: "performance_metrics",
    } as unknown as RevenueOsDeploymentFeedbackRow;
    const parsed = rowToNormalized(row);
    expect(parsed?.feedbackRowKind).toBe("performance_metrics");
  });

  it("buildDeploymentFeedbackSignalsInput aggregates counts and platforms", () => {
    const normalized = [
      normalizePublishOutcomeToFeedback({
        campaignPostId: "a",
        campaignId: "c",
        platform: "linkedin",
        outcome: "published",
        source: "publish_worker",
      }),
      normalizePublishOutcomeToFeedback({
        campaignPostId: "b",
        campaignId: "c",
        platform: "x",
        outcome: "published",
        source: "publish_worker",
      }),
      normalizePublishOutcomeToFeedback({
        campaignPostId: "c",
        campaignId: "c",
        platform: "instagram",
        outcome: "failed",
        source: "publish_worker",
      }),
    ];
    const input = buildDeploymentFeedbackSignalsInput(normalized);
    expect(input.publishedCount).toBe(2);
    expect(input.failedCount).toBe(1);
    expect(input.publishedPlatforms).toBe(2);
  });

  it("buildDeploymentFeedbackSignalsInput ignores performance_metrics for publishedPlatforms count", () => {
    const normalized = [
      normalizePublishOutcomeToFeedback({
        campaignPostId: "a",
        campaignId: "c",
        platform: "linkedin",
        outcome: "published",
        source: "publish_worker",
      }),
      normalizePerformanceSnapshotToFeedback({
        campaignPostId: "a",
        campaignId: "c",
        platform: "linkedin",
        source: "platform_sync",
        impressions: 999,
      }),
    ];
    const input = buildDeploymentFeedbackSignalsInput(normalized);
    expect(input.publishedPlatforms).toBe(1);
    expect(input.hasPerformanceMetrics).toBe(true);
  });

  it("buildDeploymentFeedbackSignalsInput includes measured vs publish-only split and rollup fields", () => {
    const normalized = [
      normalizePublishOutcomeToFeedback({
        campaignPostId: "ig1",
        campaignId: "c",
        platform: "instagram",
        outcome: "published",
        source: "publish_worker",
      }),
      normalizePerformanceSnapshotToFeedback({
        campaignPostId: "ig1",
        campaignId: "c",
        platform: "instagram",
        source: "platform_sync",
        impressions: 2500,
        engagement: 12,
      }),
      normalizePublishOutcomeToFeedback({
        campaignPostId: "tk1",
        campaignId: "c",
        platform: "tiktok",
        outcome: "published",
        source: "publish_worker",
      }),
      normalizePerformanceSnapshotToFeedback({
        campaignPostId: "tk1",
        campaignId: "c",
        platform: "tiktok",
        source: "platform_sync",
        impressions: 80000,
        clicks: 200,
      }),
    ];
    const input = buildDeploymentFeedbackSignalsInput(normalized);
    expect(input.measuredEngagementTotal).toBeGreaterThan(0);
    expect(input.publishOnlyEngagementTotal).toBeGreaterThan(input.measuredEngagementTotal!);
    expect(input.measuredMetricPostCount).toBe(1);
    expect(input.bestMeasuredPlatform).toBe("instagram");
    expect(input.attentionSignalStrength).not.toBe("none");

    const base: RevenueOsSystemSignals = {
      trafficReadinessScore: 50,
      executionGapScore: 30,
      opportunityScore: 55,
      offerStrengthScore: 50,
      capitalReadinessScore: 40,
    };
    const naive = enrichSystemSignalsFromFeedback(base, {
      ...input,
      measuredEngagementTotal: undefined,
      publishOnlyEngagementTotal: undefined,
      measuredMetricPostCount: undefined,
      bestMeasuredPlatform: undefined,
      bestPublishedPlatform: undefined,
      attentionSignalStrength: undefined,
    });
    const weighted = enrichSystemSignalsFromFeedback(base, input);
    expect(weighted.opportunityScore).toBeLessThanOrEqual(naive.opportunityScore);
  });
});
