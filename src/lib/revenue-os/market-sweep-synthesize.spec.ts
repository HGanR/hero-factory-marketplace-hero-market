import { buildDeterministicMarketSweepParsed } from "@/lib/revenue-os/market-sweep-synthesize";

describe("buildDeterministicMarketSweepParsed", () => {
  it("fills all buckets with enough lines for downstream verification", () => {
    const m = buildDeterministicMarketSweepParsed({
      industry: "SaaS",
      targetAudience: "Founders",
      platforms: ["LinkedIn"],
      bundle: { signals: [], bySource: {}, errors: [] },
    });
    const n =
      (m.trendingTopics?.length ?? 0) +
      (m.viralHooks?.length ?? 0) +
      (m.painPoints?.length ?? 0) +
      (m.commentInsights?.length ?? 0);
    expect(n).toBeGreaterThanOrEqual(2);
    expect(m.trendingTopics.length).toBeGreaterThan(0);
  });
});
