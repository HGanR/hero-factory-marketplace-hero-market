import { planBentleyExperiment } from "./experiment-planner";
import type {
  ContentGenerationMode,
  GrowthGuidance,
  MarketIntelligenceDiff,
  MarketSweepNextAction,
  MarketSweepResult,
} from "./market-sweep-schema";

describe("planBentleyExperiment", () => {
  const nextAction: MarketSweepNextAction = { action: "continue_pipeline", reason: "x", priority: 1 };
  const growthGuidance: GrowthGuidance = {
    recommendedNextMove: "m",
    why: "w",
    risingTopics: ["topic a", "topic b"],
    weakAngles: ["weak"],
    bestHookDirection: "POV",
  };
  const diff: MarketIntelligenceDiff = {
    hasPrior: true,
    newTopics: ["n1"],
    droppedTopics: [],
    strengthenedHooks: [],
    weakenedHooks: [],
    summary: "s",
  };

  it("returns null when sweep signal is too thin", () => {
    const hybrid: MarketSweepResult = {
      trendingTopics: ["a"],
      viralHooks: [],
      painPoints: [],
      buyingSignals: [],
      commentInsights: [],
      competitorAngles: [],
      contentGaps: [],
      hybridMeta: { realSignalCount: 0, sourcesConnected: [] },
    };
    const out = planBentleyExperiment({
      nextAction,
      contentGenerationMode: "balanced" as ContentGenerationMode,
      growthGuidance,
      topPerformingTopics: [],
      underperformingTopics: [],
      topPerformingHookTypes: [],
      marketIntelligenceDiff: diff,
      hybrid,
      defaultPlatforms: [],
    });
    expect(out.plan).toBeNull();
    expect(out.skippedReason).toBeDefined();
  });

  it("returns variants when minimum signal is met", () => {
    const hybrid: MarketSweepResult = {
      trendingTopics: ["a", "b", "c", "d"],
      viralHooks: ["h1", "h2"],
      painPoints: [],
      buyingSignals: [],
      commentInsights: [],
      competitorAngles: [],
      contentGaps: [],
      hybridMeta: { realSignalCount: 3, sourcesConnected: ["reddit"] },
    };
    const out = planBentleyExperiment({
      nextAction,
      contentGenerationMode: "balanced" as ContentGenerationMode,
      growthGuidance,
      topPerformingTopics: ["t1"],
      underperformingTopics: [],
      topPerformingHookTypes: ["pov"],
      marketIntelligenceDiff: diff,
      hybrid,
      defaultPlatforms: ["TikTok"],
    });
    expect(out.plan?.variants.length).toBeGreaterThanOrEqual(3);
    expect(out.plan?.hypothesis.length).toBeGreaterThan(10);
    const keys = new Set(out.plan?.variants.map((v) => v.variantKey));
    expect(keys.size).toBe(out.plan?.variants.length);
  });
});
