import { describe, expect, it } from "@jest/globals";
import { aggregateInboxInsights } from "./engagement-insights";

describe("aggregateInboxInsights", () => {
  it("aggregates intents and examples", () => {
    const a = aggregateInboxInsights(
      [
        {
          id: "1",
          sourceType: "comment",
          intent: "question",
          sentiment: "neutral",
          status: "new",
          lastMessageAt: new Date(),
          preview: "What is price?",
          provider: "meta",
          metadataJson: null,
        },
        {
          id: "2",
          sourceType: "comment",
          intent: "lead",
          sentiment: "positive",
          status: "new",
          lastMessageAt: new Date(),
          preview: "Interested in a demo",
          provider: "meta",
          metadataJson: null,
        },
      ],
      2
    );
    expect(a.byIntent.question?.count).toBe(1);
    expect(a.topQuestionsThisWeek.length).toBe(1);
    expect(a.highIntentThreads.length).toBe(1);
  });
});
