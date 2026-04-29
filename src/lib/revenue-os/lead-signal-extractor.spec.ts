import { extractLeadSignalsFromFeedback } from "./lead-signal-extractor";

describe("extractLeadSignalsFromFeedback", () => {
  it("returns empty for empty input", () => {
    expect(extractLeadSignalsFromFeedback({})).toEqual([]);
  });

  it("classifies buying intent from raw interactions", () => {
    const out = extractLeadSignalsFromFeedback({
      rawInteractions: [{ platform: "instagram", text: "I want to buy this today, what is the price?" }],
    });
    expect(out.length).toBe(1);
    expect(out[0].signalClass).toBe("buying_intent");
    expect(out[0].commercialIntentScore).toBeGreaterThan(0.7);
  });

  it("handles sparse partial payloads without throwing", () => {
    const out = extractLeadSignalsFromFeedback({
      contentFeedbackRows: [{ notes: "ok", platform: "x" }],
      rawInteractions: [{}],
    });
    expect(Array.isArray(out)).toBe(true);
  });
});
