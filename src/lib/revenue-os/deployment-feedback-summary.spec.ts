import {
  coarseEngagementSplitForSignals,
  summarizeDeploymentFeedback,
  summarizeDeploymentFeedbackByPlatform,
} from "@/lib/revenue-os/deployment-feedback-summary";
import type { NormalizedDeploymentFeedback } from "@/lib/revenue-os/deployment-feedback-contract";

function row(partial: Partial<NormalizedDeploymentFeedback> & Pick<NormalizedDeploymentFeedback, "publishStatus">): NormalizedDeploymentFeedback {
  return {
    campaignPostId: partial.campaignPostId ?? "p",
    campaignId: partial.campaignId ?? "c",
    platform: partial.platform ?? "linkedin",
    publishStatus: partial.publishStatus,
    source: partial.source ?? "publish_worker",
    recordedAt: partial.recordedAt ?? "2026-01-01T00:00:00.000Z",
    publishedAt: partial.publishedAt ?? null,
    impressions: partial.impressions ?? null,
    clicks: partial.clicks ?? null,
    engagement: partial.engagement ?? null,
    comments: partial.comments ?? null,
    shares: partial.shares ?? null,
    saves: partial.saves ?? null,
    leads: partial.leads ?? null,
    ctr: partial.ctr ?? null,
    cpc: partial.cpc ?? null,
    platformPostId: partial.platformPostId ?? null,
    errorCode: partial.errorCode ?? null,
    errorMessage: partial.errorMessage ?? null,
    feedbackRowKind: partial.feedbackRowKind,
    syncedAt: partial.syncedAt,
  };
}

describe("deployment-feedback-summary", () => {
  it("publish success only", () => {
    const s = summarizeDeploymentFeedback([
      row({ publishStatus: "published", publishedAt: "2026-01-02T00:00:00.000Z" }),
    ]);
    expect(s.publishedCount).toBe(1);
    expect(s.failedCount).toBe(0);
    expect(s.retryCount).toBe(0);
    expect(s.hasPerformanceMetrics).toBe(false);
  });

  it("publish failure only", () => {
    const s = summarizeDeploymentFeedback([row({ publishStatus: "failed" })]);
    expect(s.publishedCount).toBe(0);
    expect(s.failedCount).toBe(1);
  });

  it("mixed success/failure + retries", () => {
    const s = summarizeDeploymentFeedback([
      row({ publishStatus: "published", campaignPostId: "1" }),
      row({ publishStatus: "failed", campaignPostId: "2" }),
      row({ publishStatus: "retry_scheduled", campaignPostId: "3" }),
    ]);
    expect(s.publishedCount).toBe(1);
    expect(s.failedCount).toBe(1);
    expect(s.retryCount).toBe(1);
  });

  it("metric-enriched rows set hasPerformanceMetrics and by-platform scores", () => {
    const rows = [
      row({
        publishStatus: "published",
        platform: "linkedin",
        impressions: 1000,
        clicks: 50,
        campaignPostId: "a",
      }),
      row({
        publishStatus: "published",
        platform: "x",
        impressions: 500,
        clicks: 5,
        campaignPostId: "b",
      }),
    ];
    const s = summarizeDeploymentFeedback(rows);
    expect(s.hasPerformanceMetrics).toBe(true);
    const by = summarizeDeploymentFeedbackByPlatform(rows);
    expect(by.linkedin).toBeGreaterThan(by.x!);
  });

  it("splits best measured vs best published when Instagram has metrics and LinkedIn is publish-only tier", () => {
    const ctx = { liveMetricPlatforms: ["instagram"], stubPublishPlatforms: ["linkedin"] };
    const rows = [
      row({
        publishStatus: "published",
        platform: "linkedin",
        campaignPostId: "l1",
        impressions: 5000,
        clicks: 40,
      }),
      row({
        publishStatus: "published",
        platform: "instagram",
        campaignPostId: "i1",
        impressions: 800,
        clicks: 5,
      }),
    ];
    const s = summarizeDeploymentFeedback(rows, { metricSyncContext: ctx });
    expect(s.bestMeasuredPlatform).toBe("instagram");
    expect(s.bestPublishedPlatform).toBeDefined();
    expect(s.recommendationHints.some((h) => /measured/i.test(h))).toBe(true);
  });

  it("publish-only across platforms does not emit a measured winner", () => {
    const ctx = { liveMetricPlatforms: ["instagram"], stubPublishPlatforms: ["linkedin", "x"] };
    const rows = [
      row({
        publishStatus: "published",
        platform: "linkedin",
        campaignPostId: "a",
        impressions: 2000,
      }),
    ];
    const s = summarizeDeploymentFeedback(rows, { metricSyncContext: ctx });
    expect(s.bestMeasuredPlatform).toBeUndefined();
    expect(s.recommendationHints.some((h) => /operational|published/i.test(h))).toBe(true);
  });

  it("unsupported-tier platforms never become bestMeasuredPlatform", () => {
    const ctx = { liveMetricPlatforms: ["instagram"], stubPublishPlatforms: ["linkedin"] };
    const rows = [
      row({
        publishStatus: "published",
        platform: "tiktok",
        campaignPostId: "t1",
        impressions: 90000,
        clicks: 900,
      }),
    ];
    const s = summarizeDeploymentFeedback(rows, { metricSyncContext: ctx });
    expect(s.bestMeasuredPlatform).toBeUndefined();
  });

  it("Bentley-style: only publish-state yields clear hint", () => {
    const s = summarizeDeploymentFeedback([
      row({ publishStatus: "published", campaignPostId: "1" }),
    ]);
    expect(s.hasPerformanceMetrics).toBe(false);
    expect(s.recommendationHints.some((h) => /impressions|clicks|performance sync/i.test(h))).toBe(true);
  });

  it("coarseEngagementSplitForSignals separates live-metrics totals from publish-only tier", () => {
    const ctx = { liveMetricPlatforms: ["instagram"], stubPublishPlatforms: ["linkedin"] };
    const rows = [
      row({
        publishStatus: "published",
        platform: "linkedin",
        campaignPostId: "l1",
        impressions: 5000,
        clicks: 40,
      }),
      row({
        publishStatus: "published",
        platform: "instagram",
        campaignPostId: "i1",
        impressions: 800,
        clicks: 5,
      }),
    ];
    const split = coarseEngagementSplitForSignals(rows, ctx);
    expect(split.measuredMetricPostCount).toBe(1);
    expect(split.measuredTotal).toBeGreaterThan(0);
    expect(split.publishOnlyTotal).toBeGreaterThan(split.measuredTotal);
  });

  it("performance_metrics rows do not inflate publishedCount", () => {
    const s = summarizeDeploymentFeedback([
      row({
        publishStatus: "published",
        campaignPostId: "same",
        feedbackRowKind: "publish_outcome",
        source: "publish_worker",
      }),
      row({
        publishStatus: "published",
        campaignPostId: "same",
        feedbackRowKind: "performance_metrics",
        source: "platform_sync",
        impressions: 5000,
        recordedAt: "2026-02-01T00:00:00.000Z",
        syncedAt: "2026-02-01T00:00:00.000Z",
      }),
    ]);
    expect(s.publishedCount).toBe(1);
    expect(s.hasPerformanceMetrics).toBe(true);
    expect(s.attentionSignalStrength).not.toBe("none");
  });
});
