import { planBentleyDistribution } from "./distribution-planner";
import type { MarketSweepExperimentPlan } from "./market-sweep-schema";

describe("planBentleyDistribution", () => {
  const basePlan: MarketSweepExperimentPlan = {
    hypothesis: "test",
    experimentTheme: "theme",
    primaryMetric: "engagement_rate",
    recommendedPlatforms: ["Instagram", "TikTok"],
    variants: [
      {
        variantKey: "A",
        hookType: "pov",
        angle: "angle a",
        ctaType: "comment",
        framingStyle: "authentic_ugc",
        platform: "Instagram",
        contentType: "Reel",
      },
      {
        variantKey: "B",
        hookType: "list",
        angle: "angle b",
        ctaType: "save",
        framingStyle: "educational_authority",
        platform: "TikTok",
        contentType: "Short",
      },
      {
        variantKey: "C",
        hookType: "story",
        angle: "angle c",
        ctaType: "dm",
        framingStyle: "case_study",
        platform: "Instagram",
        contentType: "Carousel",
      },
    ],
  };

  it("buckets launch, test, and hold for scale mode", () => {
    const out = planBentleyDistribution({
      experimentPlan: basePlan,
      experimentAnalysis: null,
      nextAction: { action: "double_down_content", reason: "x", priority: 3 },
      contentGenerationMode: "scale_winners",
      growthGuidance: {
        recommendedNextMove: "m",
        why: "w",
        risingTopics: ["t"],
        weakAngles: [],
        bestHookDirection: "h",
      },
      winningVariants: ["A"],
      recommendedPlatforms: ["Instagram", "TikTok"],
      topPerformingHookTypes: ["pov"],
    });
    expect(out.launchNow.length).toBeGreaterThanOrEqual(1);
    expect(out.summary).toContain("Launch now");
    expect(out.platformFormatHints.length).toBeGreaterThan(0);
  });

  it("returns degraded single slot when no variants but hook types exist", () => {
    const out = planBentleyDistribution({
      experimentPlan: null,
      experimentAnalysis: null,
      nextAction: { action: "continue_pipeline", reason: "x", priority: 1 },
      contentGenerationMode: "balanced",
      growthGuidance: {
        recommendedNextMove: "m",
        why: "w",
        risingTopics: ["rising"],
        weakAngles: [],
        bestHookDirection: "h",
      },
      winningVariants: [],
      recommendedPlatforms: ["LinkedIn"],
      topPerformingHookTypes: ["contrarian"],
    });
    expect(out.launchNow.length).toBeGreaterThanOrEqual(1);
  });
});
