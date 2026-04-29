/**
 * @jest-environment node
 */

import {
  buildPlatformRoleRoutingGenerationHint,
  derivePlatformRoleRouting,
} from "@/lib/revenue-os/platform-role-routing";
import type { DeploymentFeedbackRollup } from "@/lib/revenue-os/deployment-feedback-summary";
import type { RevenueOsOptimizationMemorySummary } from "@/lib/revenue-os/post-optimization-memory-types";
import type { DeploymentFeedbackSignalsInput } from "@/lib/revenue-os/derive-system-signals-from-feedback";

function baseRollup(partial: Partial<DeploymentFeedbackRollup>): DeploymentFeedbackRollup {
  return {
    publishedCount: 0,
    failedCount: 0,
    retryCount: 0,
    latestPublishedAt: null,
    hasPerformanceMetrics: false,
    attentionSignalStrength: "none",
    recommendationHints: [],
    ...partial,
  };
}

describe("derivePlatformRoleRouting", () => {
  it("chooses Instagram for attention and LinkedIn for engagement when rollup provides split leaders", () => {
    const rollup = baseRollup({
      hasPerformanceMetrics: true,
      publishedCount: 4,
      failedCount: 0,
      bestAttentionPlatform: "instagram",
      bestEngagementPlatform: "linkedin",
      comparisonConfidence: "high",
      bestPublishedPlatform: "linkedin",
      bestMeasuredPlatform: "instagram",
    });
    const r = derivePlatformRoleRouting({
      deploymentRollup: rollup,
      memorySummary: null,
      metricSyncContext: { liveMetricPlatforms: ["instagram", "linkedin"], stubPublishPlatforms: [] },
      signalsInput: { leadCount: 0, anyReportedClicks: false } as DeploymentFeedbackSignalsInput,
    });
    const att = r.recommendations.find((x) => x.role === "attention");
    const eng = r.recommendations.find((x) => x.role === "engagement");
    expect(att?.preferredPlatform).toBe("instagram");
    expect(att?.evidenceBasis).toBe("measured_attention");
    expect(eng?.preferredPlatform).toBe("linkedin");
    expect(eng?.evidenceBasis).toBe("measured_engagement");
  });

  it("authority prefers measured engagement platform conservatively when publish track is stable", () => {
    const rollup = baseRollup({
      hasPerformanceMetrics: true,
      publishedCount: 5,
      failedCount: 0,
      bestEngagementPlatform: "linkedin",
      comparisonConfidence: "medium",
      bestPublishedPlatform: "linkedin",
    });
    const r = derivePlatformRoleRouting({ deploymentRollup: rollup, memorySummary: null });
    const auth = r.recommendations.find((x) => x.role === "authority");
    expect(auth?.preferredPlatform).toBe("linkedin");
    expect(auth?.evidenceBasis).toBe("measured_engagement");
  });

  it("lead_capture stays insufficient without leads; does not invent from engagement alone", () => {
    const rollup = baseRollup({
      hasPerformanceMetrics: true,
      bestEngagementPlatform: "linkedin",
      bestAttentionPlatform: "instagram",
    });
    const r = derivePlatformRoleRouting({
      deploymentRollup: rollup,
      memorySummary: null,
      signalsInput: { leadCount: 0, anyReportedClicks: false } as DeploymentFeedbackSignalsInput,
    });
    const lc = r.recommendations.find((x) => x.role === "lead_capture");
    expect(lc?.evidenceBasis).toBe("insufficient_data");
    expect(lc?.preferredPlatform).toBeNull();
  });

  it("publish-only tier rollup does not fabricate measured attention/engagement routing", () => {
    const rollup = baseRollup({
      hasPerformanceMetrics: true,
      publishedCount: 3,
      failedCount: 0,
      bestPublishedPlatform: "linkedin",
    });
    const r = derivePlatformRoleRouting({
      deploymentRollup: rollup,
      memorySummary: null,
      metricSyncContext: { liveMetricPlatforms: ["instagram"], stubPublishPlatforms: ["linkedin"] },
    });
    const att = r.recommendations.find((x) => x.role === "attention");
    const eng = r.recommendations.find((x) => x.role === "engagement");
    expect(att?.evidenceBasis).toBe("insufficient_data");
    expect(eng?.evidenceBasis).toBe("insufficient_data");
  });

  it("buildPlatformRoleRoutingGenerationHint stays compact and role-specific for split leaders", () => {
    const routing = derivePlatformRoleRouting({
      deploymentRollup: baseRollup({
        hasPerformanceMetrics: true,
        bestAttentionPlatform: "instagram",
        bestEngagementPlatform: "linkedin",
        comparisonConfidence: "high",
        publishedCount: 2,
      }),
      memorySummary: null,
    });
    const hint = buildPlatformRoleRoutingGenerationHint(routing);
    expect(hint).toBeTruthy();
    expect(hint!.length).toBeLessThan(280);
    expect(hint).toMatch(/Platform-role hint/i);
    expect(hint).toMatch(/Instagram/i);
    expect(hint).toMatch(/LinkedIn/i);
  });
});

describe("memory-only routing", () => {
  it("uses optimization memory split leaders when deployment rollup is absent", () => {
    const mem: RevenueOsOptimizationMemorySummary = {
      strongestPatterns: [],
      weakestPatterns: [],
      platformPreferences: {},
      hasEnoughData: true,
      nextGenerationRecommendation: "x",
      measuredStrongestAttentionPlatform: "instagram",
      measuredStrongestEngagementPlatform: "linkedin",
      crossPlatformComparisonConfidence: "medium",
    };
    const r = derivePlatformRoleRouting({
      deploymentRollup: null,
      memorySummary: mem,
    });
    expect(r.recommendations.find((x) => x.role === "attention")?.preferredPlatform).toBe("instagram");
    expect(r.recommendations.find((x) => x.role === "engagement")?.preferredPlatform).toBe("linkedin");
  });
});
