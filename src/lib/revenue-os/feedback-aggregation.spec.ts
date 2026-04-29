import { aggregateFeedbackFromRows } from "./feedback-aggregation";

describe("aggregateFeedbackFromRows", () => {
  it("returns degraded empty state when no rows", () => {
    const r = aggregateFeedbackFromRows([]);
    expect(r.feedbackCount).toBe(0);
    expect(r.degraded).toBe(true);
    expect(r.topPerformingTopics).toEqual([]);
  });

  it("computes sentiment ratios from labeled rows", () => {
    const r = aggregateFeedbackFromRows([
      { sentiment: "positive", scoreDelta: null, rawPayload: null, notes: null, platform: "tiktok" },
      { sentiment: "negative", scoreDelta: null, rawPayload: null, notes: null, platform: "tiktok" },
      { sentiment: "neutral", scoreDelta: null, rawPayload: null, notes: null, platform: "tiktok" },
    ]);
    expect(r.feedbackCount).toBe(3);
    expect(r.positiveSentimentRatio).toBeCloseTo(1 / 3, 5);
    expect(r.negativeSentimentRatio).toBeCloseTo(1 / 3, 5);
  });

  it("extracts topic from rawPayload.topic", () => {
    const r = aggregateFeedbackFromRows([
      {
        sentiment: "positive",
        scoreDelta: "0.5",
        rawPayload: { topic: "pricing transparency" },
        notes: null,
        platform: null,
      },
      {
        sentiment: "positive",
        scoreDelta: "0.2",
        rawPayload: { topic: "pricing transparency" },
        notes: null,
        platform: null,
      },
    ]);
    expect(r.topPerformingTopics.some((t) => t.includes("pricing"))).toBe(true);
  });
});
