import { buildSuggestedFaqUpdates, normalizeVisitorQuestion } from "./suggested-faq-from-messages";

describe("suggested-faq-from-messages", () => {
  it("normalizes whitespace and case", () => {
    expect(normalizeVisitorQuestion("  Hello   World  ")).toBe("hello world");
  });

  it("picks repeated questions", () => {
    const q = "What are your business hours for support on weekends?";
    const out = buildSuggestedFaqUpdates([q, q, "other", "other short"]);
    expect(out.length).toBe(1);
    expect(out[0].occurrenceCount).toBe(2);
    expect(out[0].questionSample).toContain("business hours");
  });
});
