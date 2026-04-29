import { describe, it, expect } from "@jest/globals";
import {
  mapMarketplaceRowToReviewerLookupCandidate,
  normalizeReviewerLookupQuery,
  parseReviewerLookupLimit,
  REVIEWER_LOOKUP_LIMIT_DEFAULT,
  REVIEWER_LOOKUP_LIMIT_MAX,
  REVIEWER_LOOKUP_LIMIT_MIN,
} from "@/lib/revenue-os/campaign-reviewer-assignment-lookup";

describe("normalizeReviewerLookupQuery", () => {
  it("returns null for short or empty input", () => {
    expect(normalizeReviewerLookupQuery(null)).toBeNull();
    expect(normalizeReviewerLookupQuery("")).toBeNull();
    expect(normalizeReviewerLookupQuery("a")).toBeNull();
  });

  it("accepts length >= 2", () => {
    expect(normalizeReviewerLookupQuery("ab")).toBe("ab");
  });

  it("strips LIKE metacharacters", () => {
    expect(normalizeReviewerLookupQuery("a%b_c\\d")).toBe("abcd");
  });
});

describe("parseReviewerLookupLimit", () => {
  it("defaults and clamps", () => {
    expect(parseReviewerLookupLimit(null)).toBe(REVIEWER_LOOKUP_LIMIT_DEFAULT);
    expect(parseReviewerLookupLimit("5")).toBe(5);
    expect(parseReviewerLookupLimit("10")).toBe(10);
    expect(parseReviewerLookupLimit("3")).toBe(REVIEWER_LOOKUP_LIMIT_MIN);
    expect(parseReviewerLookupLimit("99")).toBe(REVIEWER_LOOKUP_LIMIT_MAX);
  });
});

describe("mapMarketplaceRowToReviewerLookupCandidate", () => {
  it("maps id to userId and uses username as displayName", () => {
    expect(
      mapMarketplaceRowToReviewerLookupCandidate({
        id: 42,
        username: "pat",
        email: "p@example.com",
      })
    ).toEqual({
      userId: 42,
      displayName: "pat",
      email: "p@example.com",
    });
  });
});
