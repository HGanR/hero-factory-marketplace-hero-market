/**
 * @jest-environment node
 */
import { describe, it, expect } from "@jest/globals";
import {
  deriveOrganicPerformanceSignals,
  ORGANIC_HIGH_IMPRESSIONS_THRESHOLD,
  ORGANIC_HIGH_ENGAGEMENT_THRESHOLD,
} from "@/lib/social/organic-performance-signals";

describe("deriveOrganicPerformanceSignals", () => {
  it("returns no signals when metrics are empty", () => {
    const r = deriveOrganicPerformanceSignals({});
    expect(r.signals).toEqual([]);
    expect(r.candidateForPromotion).toBe(false);
  });

  it("flags high_impressions", () => {
    const r = deriveOrganicPerformanceSignals({
      impressions: ORGANIC_HIGH_IMPRESSIONS_THRESHOLD,
    });
    expect(r.candidateForPromotion).toBe(true);
    expect(r.signals.some((s) => s.code === "high_impressions")).toBe(true);
  });

  it("flags high_engagement via engagementsTotal", () => {
    const r = deriveOrganicPerformanceSignals({
      engagementsTotal: ORGANIC_HIGH_ENGAGEMENT_THRESHOLD,
    });
    expect(r.candidateForPromotion).toBe(true);
    expect(r.signals.some((s) => s.code === "high_engagement")).toBe(true);
  });

  it("flags above_campaign_average when average is provided", () => {
    const r = deriveOrganicPerformanceSignals(
      { impressions: 2000 },
      { campaignAverageImpressions: 1000 }
    );
    expect(r.signals.some((s) => s.code === "above_campaign_average")).toBe(true);
    expect(r.candidateForPromotion).toBe(true);
  });
});
