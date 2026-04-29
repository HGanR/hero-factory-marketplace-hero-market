/**
 * @jest-environment node
 */

import type { NormalizedDeploymentFeedback } from "@/lib/revenue-os/deployment-feedback-contract";
import {
  buildMeasuredPlatformRoleHint,
  engagementComparableRaw,
  finalizeComparableSummaryFromPerPlatformStrengths,
  normalizeComparablePerformanceSignal,
  summarizeComparablePlatformPerformance,
} from "@/lib/revenue-os/cross-platform-performance-normalization";
import { summarizeDeploymentFeedback, rowsForMetricAggregation } from "@/lib/revenue-os/deployment-feedback-summary";

const liveCtx = { liveMetricPlatforms: ["instagram", "linkedin"], stubPublishPlatforms: [] as string[] };

function perfRow(
  partial: Partial<NormalizedDeploymentFeedback> & Pick<NormalizedDeploymentFeedback, "platform" | "campaignPostId">
): NormalizedDeploymentFeedback {
  return {
    campaignId: partial.campaignId ?? "c",
    publishStatus: partial.publishStatus ?? "published",
    source: partial.source ?? "platform_sync",
    recordedAt: partial.recordedAt ?? "2026-01-01T00:00:00.000Z",
    feedbackRowKind: "performance_metrics",
    syncedAt: partial.syncedAt ?? "2026-01-01T00:00:00.000Z",
    impressions: partial.impressions ?? null,
    clicks: partial.clicks ?? null,
    engagement: partial.engagement ?? null,
    comments: partial.comments ?? null,
    shares: partial.shares ?? null,
    saves: partial.saves ?? null,
    leads: partial.leads ?? null,
    platformPostId: partial.platformPostId ?? null,
    publishedAt: partial.publishedAt ?? null,
    ...partial,
  } as NormalizedDeploymentFeedback;
}

describe("cross-platform-performance-normalization", () => {
  it("Instagram attention > LinkedIn when impressions exist on IG but not on LI", () => {
    const rows = [
      perfRow({ campaignPostId: "i1", platform: "instagram", impressions: 5000, comments: 2 }),
      perfRow({ campaignPostId: "l1", platform: "linkedin", impressions: null, comments: 40, engagement: 40 }),
    ];
    const metricRows = rowsForMetricAggregation(rows);
    const s = summarizeComparablePlatformPerformance({
      metricRows: metricRows.map((r) => ({
        platform: r.platform,
        impressions: r.impressions,
        clicks: r.clicks,
        engagement: r.engagement,
        comments: r.comments,
        shares: r.shares,
        saves: r.saves,
        leads: r.leads,
        evidenceQuality: "live_metrics",
        feedbackRowKind: "performance_metrics",
      })),
      ctx: liveCtx,
    });
    expect(s.bestAttentionPlatform).toBe("instagram");
    expect(s.bestEngagementPlatform).toBe("linkedin");
    expect(s.bestAttentionPlatform).not.toBe(s.bestEngagementPlatform);
  });

  it("LinkedIn engagement > Instagram engagement without implying LinkedIn wins attention", () => {
    const rows = [
      perfRow({ campaignPostId: "i1", platform: "instagram", impressions: 100, comments: 1 }),
      perfRow({ campaignPostId: "l1", platform: "linkedin", impressions: null, comments: 200, engagement: 200 }),
    ];
    const metricRows = rowsForMetricAggregation(rows);
    const s = summarizeComparablePlatformPerformance({
      metricRows: metricRows.map((r) => ({
        platform: r.platform,
        impressions: r.impressions,
        clicks: r.clicks,
        engagement: r.engagement,
        comments: r.comments,
        shares: r.shares,
        saves: r.saves,
        leads: r.leads,
        evidenceQuality: "live_metrics",
        feedbackRowKind: "performance_metrics",
      })),
      ctx: liveCtx,
    });
    expect(s.bestEngagementPlatform).toBe("linkedin");
    expect(s.platformsWithAttentionData).toEqual(["instagram"]);
    expect(s.platformsWithEngagementData.length).toBeGreaterThanOrEqual(1);
    expect(s.safeNarrativeLines.some((l) => /different metric classes|directional/i.test(l))).toBe(true);
  });

  it("publish-only tier metrics do not create measured cross-platform winners in rollup", () => {
    const stubCtx = { liveMetricPlatforms: ["instagram"], stubPublishPlatforms: ["linkedin"] };
    const rows = [
      perfRow({ campaignPostId: "l1", platform: "linkedin", impressions: 90000, comments: 500 }),
    ];
    const rollup = summarizeDeploymentFeedback(rows, { metricSyncContext: stubCtx });
    expect(rollup.bestMeasuredPlatform).toBeUndefined();
    expect(rollup.bestAttentionPlatform).toBeUndefined();
    expect(rollup.bestEngagementPlatform).toBeUndefined();
  });

  it("low-data mixed engagement-only metrics yield low comparison confidence", () => {
    const rows = [
      perfRow({ campaignPostId: "i1", platform: "instagram", impressions: null, comments: 1 }),
      perfRow({ campaignPostId: "l1", platform: "linkedin", impressions: null, comments: 2 }),
    ];
    const metricRows = rowsForMetricAggregation(rows);
    const s = summarizeComparablePlatformPerformance({
      metricRows: metricRows.map((r) => ({
        platform: r.platform,
        impressions: r.impressions,
        clicks: r.clicks,
        engagement: r.engagement,
        comments: r.comments,
        shares: r.shares,
        saves: r.saves,
        leads: r.leads,
        evidenceQuality: "live_metrics",
        feedbackRowKind: "performance_metrics",
      })),
      ctx: liveCtx,
    });
    expect(s.comparisonConfidence).toBe("low");
    expect(s.confidenceNotes.some((n) => /engagement_only/i.test(n))).toBe(true);
  });

  it("buildMeasuredPlatformRoleHint distinguishes attention vs engagement in one line", () => {
    const h = buildMeasuredPlatformRoleHint({
      bestAttentionPlatform: "instagram",
      bestEngagementPlatform: "linkedin",
      comparisonConfidence: "medium",
    });
    expect(h).toMatch(/Instagram/i);
    expect(h).toMatch(/LinkedIn/i);
    expect(h).toMatch(/attention/i);
    expect(h).toMatch(/engagement/i);
    expect(h!.length).toBeLessThan(220);
  });

  it("normalizeComparablePerformanceSignal skips publish_outcome rows without metric payload", () => {
    const r = normalizeComparablePerformanceSignal(
      {
        platform: "instagram",
        impressions: null,
        engagement: null,
        comments: null,
        evidenceQuality: "live_metrics",
        feedbackRowKind: "publish_outcome",
      },
      liveCtx
    );
    expect(r.signals.length).toBe(0);
  });

  it("normalizeComparablePerformanceSignal allows live metrics on publish_outcome when payload exists (edge path)", () => {
    const r = normalizeComparablePerformanceSignal(
      {
        platform: "instagram",
        impressions: 100,
        evidenceQuality: "live_metrics",
        feedbackRowKind: "publish_outcome",
      },
      liveCtx
    );
    expect(r.signals.some((s) => s.kind === "attention")).toBe(true);
  });

  it("engagementComparableRaw excludes impressions mass", () => {
    const a = engagementComparableRaw({ impressions: 1_000_000, comments: 1 });
    const b = engagementComparableRaw({ impressions: 10, comments: 1 });
    expect(a).toBe(b);
  });

  it("finalizeComparableSummaryFromPerPlatformStrengths infers metric classes", () => {
    const s = finalizeComparableSummaryFromPerPlatformStrengths({
      x: { attentionStrength: 10, engagementStrength: 0, metricClasses: [] },
    });
    expect(s.perPlatform.x?.metricClasses).toContain("attention_impressions");
  });
});
