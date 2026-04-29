import { computeMarketIntelligenceDiff } from "./market-intelligence-diff";
import type { MarketSweepResult } from "./market-sweep-schema";

function baseSweep(over: Partial<MarketSweepResult> = {}): MarketSweepResult {
  return {
    trendingTopics: [],
    viralHooks: [],
    painPoints: [],
    buyingSignals: [],
    commentInsights: [],
    competitorAngles: [],
    contentGaps: [],
    ...over,
  };
}

describe("computeMarketIntelligenceDiff", () => {
  it("reports no prior snapshot", () => {
    const cur = baseSweep({ trendingTopics: ["a"] });
    const d = computeMarketIntelligenceDiff(null, cur);
    expect(d.hasPrior).toBe(false);
    expect(d.summary).toMatch(/baseline/i);
  });

  it("detects new and dropped topics", () => {
    const prior = baseSweep({ trendingTopics: ["old theme", "shared"] });
    const cur = baseSweep({ trendingTopics: ["shared", "new hot theme"] });
    const d = computeMarketIntelligenceDiff(prior, cur);
    expect(d.hasPrior).toBe(true);
    expect(d.newTopics.some((t) => t.includes("new hot"))).toBe(true);
    expect(d.droppedTopics.some((t) => t.includes("old theme"))).toBe(true);
  });
});
