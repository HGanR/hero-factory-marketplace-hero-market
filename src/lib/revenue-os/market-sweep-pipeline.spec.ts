/**
 * @jest-environment node
 */
import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import { runMarketIntelligenceSweepPipeline } from "@/lib/revenue-os/market-sweep-pipeline";

jest.mock("@/lib/revenue-os/market-signals/aggregateRealSignals", () => ({
  aggregateRealMarketSignals: async () => ({
    signals: [
      { source: "reddit" as const, title: "How pricing strategy changed for B2B SaaS in 2026" },
      { source: "reddit" as const, title: "Founders share onboarding mistakes — discussion" },
    ],
    bySource: { reddit: 2 },
    errors: [],
  }),
}));

jest.mock("@/lib/revenue-os/feedback-aggregation", () => ({
  fetchFeedbackAggregationForSweep: async () => ({
    feedbackCount: 0,
    negativeSentimentRatio: 0,
    positiveSentimentRatio: 0,
    topPerformingTopics: [],
    underperformingTopics: [],
    topPerformingHookTypes: [],
    degraded: true,
  }),
}));

jest.mock("@/lib/revenue-os/persist-market-intelligence", () => ({
  fingerprintMarketSweepQuery: () => "fp-test",
  fetchLatestMarketSweepSnapshot: async () => null,
}));

jest.mock("@/lib/revenue-os/market-sweep-synthesize", () => {
  const actual = jest.requireActual("@/lib/revenue-os/market-sweep-synthesize") as typeof import("@/lib/revenue-os/market-sweep-synthesize");
  return {
    ...actual,
    synthesizeMarketSweepWithLlm: () => Promise.resolve({ ok: false, error: "forced deterministic in test" }),
  };
});

describe("runMarketIntelligenceSweepPipeline", () => {
  beforeEach(() => {
    delete process.env.OPENAI_API_KEY;
  });

  it("returns hybrid-finalized MarketSweepResult with nextAction and growthGuidance", async () => {
    const out = await runMarketIntelligenceSweepPipeline({
      industry: "SaaS",
      targetAudience: "Founders",
      platforms: ["LinkedIn"],
      clientId: "c1",
      trustId: "t1",
      userId: "u1",
    });

    expect(out.result.nextAction?.action).toBeTruthy();
    expect(out.result.growthGuidance?.recommendedNextMove).toBeTruthy();
    expect(out.result.trendingTopics.length).toBeGreaterThan(0);
    expect(out.result.hybridMeta?.realSignalCount).toBe(2);
    expect(out.connectedIntegrations).toContain("reddit");
    expect(out.llmUsed).toBe(false);
  });
});
