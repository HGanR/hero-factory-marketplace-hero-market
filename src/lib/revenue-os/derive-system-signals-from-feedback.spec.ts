import {
  computeEvidenceAwarePerformanceEngagement,
  enrichSystemSignalsFromFeedback,
} from "@/lib/revenue-os/derive-system-signals-from-feedback";
import type { DeploymentFeedbackSignalsInput } from "@/lib/revenue-os/derive-system-signals-from-feedback";
import type { RevenueOsSystemSignals } from "@/lib/revenue-os/revenue-os-system-signals-types";

function fbBase(over: Partial<DeploymentFeedbackSignalsInput> = {}): DeploymentFeedbackSignalsInput {
  return {
    publishedCount: 2,
    failedCount: 0,
    retryScheduledCount: 0,
    hasPerformanceMetrics: true,
    publishedPlatforms: 2,
    ...over,
  };
}

describe("computeEvidenceAwarePerformanceEngagement", () => {
  it("uses legacy engagement when split totals are absent", () => {
    expect(computeEvidenceAwarePerformanceEngagement(fbBase({ engagementSignalStrength: 80 }))).toBe(80);
  });

  it("mixed measured + publish-only caps publish tail so volume does not dominate", () => {
    const blended = computeEvidenceAwarePerformanceEngagement(
      fbBase({
        measuredEngagementTotal: 40,
        publishOnlyEngagementTotal: 8000,
        measuredMetricPostCount: 1,
        engagementSignalStrength: 8040,
      })
    );
    const naiveLegacy = 8040;
    expect(blended).toBeLessThan(naiveLegacy * 0.2);
    expect(blended).toBeGreaterThan(10);
  });

  it("publish-only-only path matches publish-only total", () => {
    expect(
      computeEvidenceAwarePerformanceEngagement(
        fbBase({
          measuredEngagementTotal: 0,
          publishOnlyEngagementTotal: 120,
          measuredMetricPostCount: 0,
          engagementSignalStrength: 120,
        })
      )
    ).toBe(120);
  });

  it("dampens tiny measured samples (single post)", () => {
    const onePost = computeEvidenceAwarePerformanceEngagement(
      fbBase({
        measuredEngagementTotal: 100,
        publishOnlyEngagementTotal: 0,
        measuredMetricPostCount: 1,
        engagementSignalStrength: 100,
      })
    );
    const manyPosts = computeEvidenceAwarePerformanceEngagement(
      fbBase({
        measuredEngagementTotal: 100,
        publishOnlyEngagementTotal: 0,
        measuredMetricPostCount: 9,
        engagementSignalStrength: 100,
      })
    );
    expect(onePost).toBeLessThan(manyPosts);
    expect(manyPosts).toBe(100);
  });

  it("unsupported-only metrics behave as publish-only total (measured zero)", () => {
    expect(
      computeEvidenceAwarePerformanceEngagement(
        fbBase({
          measuredEngagementTotal: 0,
          publishOnlyEngagementTotal: 90,
          measuredMetricPostCount: 0,
          engagementSignalStrength: 90,
        })
      )
    ).toBe(90);
  });
});

describe("enrichSystemSignalsFromFeedback", () => {
  const base: RevenueOsSystemSignals = {
    trafficReadinessScore: 50,
    executionGapScore: 30,
    opportunityScore: 55,
    offerStrengthScore: 50,
    capitalReadinessScore: 40,
  };

  it("no feedback leaves scores unchanged and no enrichment flag", () => {
    const out = enrichSystemSignalsFromFeedback(base, {
      publishedCount: 0,
      failedCount: 0,
      retryScheduledCount: 0,
      hasPerformanceMetrics: false,
      publishedPlatforms: 0,
    });
    expect(out.trafficReadinessScore).toBe(50);
    expect(out.deploymentFeedbackEnriched).toBeUndefined();
  });

  it("sparse publish-only outcomes nudge traffic slightly, not wildly", () => {
    const out = enrichSystemSignalsFromFeedback(base, {
      publishedCount: 1,
      failedCount: 0,
      retryScheduledCount: 0,
      hasPerformanceMetrics: false,
      publishedPlatforms: 1,
    });
    expect(out.trafficReadinessScore).toBe(52);
    expect(out.opportunityScore).toBe(55);
    expect(out.offerStrengthScore).toBe(50);
    expect(out.deploymentFeedbackEnriched).toBe(true);
  });

  it("many failures increase execution gap conservatively", () => {
    const out = enrichSystemSignalsFromFeedback(base, {
      publishedCount: 2,
      failedCount: 5,
      retryScheduledCount: 0,
      hasPerformanceMetrics: false,
      publishedPlatforms: 1,
    });
    expect(out.executionGapScore).toBeGreaterThan(30);
    expect(out.executionGapScore).toBeLessThanOrEqual(100);
  });

  it("metric-enriched + engagement nudges opportunity conservatively", () => {
    const out = enrichSystemSignalsFromFeedback(base, {
      publishedCount: 2,
      failedCount: 0,
      retryScheduledCount: 0,
      hasPerformanceMetrics: true,
      publishedPlatforms: 2,
      engagementSignalStrength: 100,
    });
    expect(out.opportunityScore).toBe(60);
    expect(out.opportunityScore).toBeLessThanOrEqual(65);
  });

  it("mixed measured + publish-only uses evidence-aware engagement (weaker than naive sum)", () => {
    const naive = enrichSystemSignalsFromFeedback(base, {
      publishedCount: 2,
      failedCount: 0,
      retryScheduledCount: 0,
      hasPerformanceMetrics: true,
      publishedPlatforms: 2,
      engagementSignalStrength: 5000,
    });
    const evidenceAware = enrichSystemSignalsFromFeedback(base, {
      publishedCount: 2,
      failedCount: 0,
      retryScheduledCount: 0,
      hasPerformanceMetrics: true,
      publishedPlatforms: 2,
      engagementSignalStrength: 5000,
      measuredEngagementTotal: 35,
      publishOnlyEngagementTotal: 4965,
      measuredMetricPostCount: 1,
      bestMeasuredPlatform: "instagram",
      attentionSignalStrength: "light",
    });
    expect(evidenceAware.opportunityScore).toBeLessThan(naive.opportunityScore);
    expect(evidenceAware.offerStrengthScore).toBeLessThanOrEqual(naive.offerStrengthScore);
  });

  it("live measured attention adds a small traffic bump on top of publish breadth", () => {
    const without = enrichSystemSignalsFromFeedback(base, {
      publishedCount: 2,
      failedCount: 0,
      retryScheduledCount: 0,
      hasPerformanceMetrics: true,
      publishedPlatforms: 2,
      engagementSignalStrength: 10,
      measuredEngagementTotal: 0,
      publishOnlyEngagementTotal: 10,
      measuredMetricPostCount: 0,
    });
    const withMeasured = enrichSystemSignalsFromFeedback(base, {
      publishedCount: 2,
      failedCount: 0,
      retryScheduledCount: 0,
      hasPerformanceMetrics: true,
      publishedPlatforms: 2,
      engagementSignalStrength: 10,
      measuredEngagementTotal: 10,
      publishOnlyEngagementTotal: 0,
      measuredMetricPostCount: 1,
      bestMeasuredPlatform: "instagram",
      attentionSignalStrength: "promising",
    });
    expect(withMeasured.trafficReadinessScore).toBeGreaterThan(without.trafficReadinessScore!);
  });

  it("leads bump capital readiness modestly", () => {
    const out = enrichSystemSignalsFromFeedback(base, {
      publishedCount: 1,
      failedCount: 0,
      retryScheduledCount: 0,
      hasPerformanceMetrics: true,
      publishedPlatforms: 1,
      leadCount: 2,
      engagementSignalStrength: 100,
    });
    expect(out.capitalReadinessScore).toBeGreaterThan(40);
    expect(out.capitalReadinessScore).toBeLessThanOrEqual(100);
  });
});
