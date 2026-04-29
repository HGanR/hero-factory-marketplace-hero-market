import { decideNextAction, mapNextActionToContentGenerationMode } from "./decision-engine";
import type { MarketSweepResult } from "./market-sweep-schema";

describe("mapNextActionToContentGenerationMode", () => {
  it("maps actions to generation modes", () => {
    expect(mapNextActionToContentGenerationMode("double_down_content")).toBe("scale_winners");
    expect(mapNextActionToContentGenerationMode("iterate_messaging")).toBe("iterate_messaging");
    expect(mapNextActionToContentGenerationMode("pause_and_research")).toBe("research_first");
    expect(mapNextActionToContentGenerationMode("run_sweep")).toBe("balanced");
    expect(mapNextActionToContentGenerationMode("continue_pipeline")).toBe("balanced");
  });
});

describe("decideNextAction", () => {
  it("continues when signals and feedback are moderate", () => {
    const lastSweep: MarketSweepResult = {
      trendingTopics: ["x"],
      viralHooks: ["h"],
      painPoints: [],
      buyingSignals: [],
      commentInsights: ["c"],
      competitorAngles: [],
      contentGaps: [],
      hybridMeta: { realSignalCount: 5, sourcesConnected: ["reddit"] },
      scoredInsights: {
        trendingTopics: [
          { text: "t", score: 0.7, confidence: "medium", frequency: 1, source: "merged" },
        ],
      },
    };
    const d = decideNextAction({
      lastSweep,
      feedback: {
        feedbackCount: 5,
        negativeSentimentRatio: 0.1,
        positiveSentimentRatio: 0.5,
        topPerformingTopics: ["a"],
        underperformingTopics: [],
        topPerformingHookTypes: [],
        degraded: false,
      },
    });
    expect(d.action).toBe("double_down_content");
  });

  it("biases toward iterate when lead objection clusters dominate", () => {
    const lastSweep: MarketSweepResult = {
      trendingTopics: ["x"],
      viralHooks: ["h"],
      painPoints: [],
      buyingSignals: [],
      commentInsights: ["c"],
      competitorAngles: [],
      contentGaps: [],
      hybridMeta: { realSignalCount: 5, sourcesConnected: ["reddit"] },
    };
    const d = decideNextAction({
      lastSweep,
      feedback: {
        feedbackCount: 5,
        negativeSentimentRatio: 0.1,
        positiveSentimentRatio: 0.5,
        topPerformingTopics: ["a"],
        underperformingTopics: [],
        topPerformingHookTypes: [],
        degraded: false,
        leadSignalBias: {
          totalSignals: 5,
          objectionClusterCount: 3,
          highIntentCount: 1,
          handoffReadyCount: 0,
          trustSeekingCount: 0,
          dominantObjectionTopic: "price",
        },
      },
    });
    expect(d.action).toBe("iterate_messaging");
  });
});
