import { describe, expect, it } from "@jest/globals";

/**
 * Documents the contract between SiteBuilderAiPanel `onAiEditCompleted` and the page
 * (pulse + scroll). Pure expectations — no DOM.
 */
describe("site-builder AI edit feedback contract", () => {
  function reducePreviewFeedback(
    prevPulse: string[],
    payload: { scope: "section" | "full" | "light_page"; changedSectionIds: string[] },
  ): { pulse: string[]; scrollTopBump: number } {
    if (
      payload.changedSectionIds.length > 0 &&
      (payload.scope === "section" || payload.scope === "light_page")
    ) {
      return { pulse: payload.changedSectionIds, scrollTopBump: 0 };
    }
    if (payload.scope === "full") {
      return { pulse: [], scrollTopBump: 1 };
    }
    return { pulse: [], scrollTopBump: 0 };
  }

  it("section scope with ids sets pulse list", () => {
    const r = reducePreviewFeedback([], { scope: "section", changedSectionIds: ["a", "b"] });
    expect(r.pulse).toEqual(["a", "b"]);
    expect(r.scrollTopBump).toBe(0);
  });

  it("full scope clears pulse and requests scroll bump", () => {
    const r = reducePreviewFeedback(["x"], { scope: "full", changedSectionIds: [] });
    expect(r.pulse).toEqual([]);
    expect(r.scrollTopBump).toBe(1);
  });

  it("section scope with no ids does not pulse or bump (e.g. token-only message)", () => {
    const r = reducePreviewFeedback([], { scope: "section", changedSectionIds: [] });
    expect(r.pulse).toEqual([]);
    expect(r.scrollTopBump).toBe(0);
  });

  it("light_page scope with ids sets pulse list (page-wide refinement)", () => {
    const r = reducePreviewFeedback([], { scope: "light_page", changedSectionIds: ["a", "b", "c"] });
    expect(r.pulse).toEqual(["a", "b", "c"]);
    expect(r.scrollTopBump).toBe(0);
  });
});
