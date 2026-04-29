/**
 * @jest-environment node
 */

import {
  formatBentleyOptimizationMemoryReply,
  isOptimizationMemoryIntent,
} from "@/lib/revenue-os/bentley-optimization-memory-chat";

describe("isOptimizationMemoryIntent", () => {
  it("matches pattern and learning phrasing without grabbing generic deployment feedback", () => {
    expect(isOptimizationMemoryIntent("What patterns are working?")).toBe(true);
    expect(isOptimizationMemoryIntent("What should we stop doing")).toBe(true);
    expect(isOptimizationMemoryIntent("Which platforms seem strongest")).toBe(true);
    expect(isOptimizationMemoryIntent("What is Bentley learning")).toBe(true);
    expect(isOptimizationMemoryIntent("What should we focus on")).toBe(true);
    expect(isOptimizationMemoryIntent("What platform is best")).toBe(true);
    expect(isOptimizationMemoryIntent("hello")).toBe(false);
  });
});

describe("formatBentleyOptimizationMemoryReply", () => {
  it("surfaces Instagram measured preference when summary flag is active", () => {
    const text = formatBentleyOptimizationMemoryReply({
      entryCount: 3,
      summary: {
        strongestPatterns: [],
        weakestPatterns: [],
        platformPreferences: {},
        hasEnoughData: true,
        nextGenerationRecommendation: "Test",
        measuredStrongestPlatform: "instagram",
        instagramMeasuredPreference: {
          active: true,
          measuredPublishingVolume: 8,
          measuredMetricPostCount: 8,
          userHeadline: "Measured preference: Instagram",
          userWhy: "Highest measured attention from synced Instagram posts in optimization memory.",
          confidenceLabel: "high",
        },
      },
    });
    expect(text).toMatch(/Measured preference: Instagram/);
    expect(text).toMatch(/\*\*Confidence:\*\* high/);
    expect(text).toMatch(/Generation bias/);
  });

  it("omits Instagram preference block when inactive", () => {
    const text = formatBentleyOptimizationMemoryReply({
      entryCount: 2,
      summary: {
        strongestPatterns: [],
        weakestPatterns: [],
        platformPreferences: {},
        hasEnoughData: true,
        nextGenerationRecommendation: "Test",
        measuredStrongestPlatform: "linkedin",
      },
    });
    expect(text).not.toMatch(/Measured preference: Instagram/);
  });
});
