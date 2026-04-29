import { describe, expect, it } from "@jest/globals";
import { engagementRuleMatches } from "./engagement-apply-rules";

describe("engagementRuleMatches", () => {
  it("matches keywordsAny (case-insensitive)", () => {
    expect(engagementRuleMatches({ keywordsAny: ["price", "quote"] }, { text: "What is the Price?", sourceType: "comment", intent: null, sentiment: null })).toBe(
      true
    );
  });
  it("rejects when keyword missing", () => {
    expect(engagementRuleMatches({ keywordsAny: ["warranty"] }, { text: "price?", sourceType: "comment", intent: null, sentiment: null })).toBe(false);
  });
  it("matches intentEquals", () => {
    expect(engagementRuleMatches({ intentEquals: "complaint" }, { text: "x", sourceType: "comment", intent: "complaint", sentiment: null })).toBe(true);
  });
  it("matches sourceTypeEquals", () => {
    expect(engagementRuleMatches({ sourceTypeEquals: "dm" }, { text: "x", sourceType: "dm", intent: null, sentiment: null })).toBe(true);
  });
});
