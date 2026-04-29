import { describe, expect, it } from "@jest/globals";
import { resolveOmnibarSubmitRoute } from "@/lib/site-builder/site-builder-omnibar-routing";

describe("site-builder-omnibar-routing", () => {
  it("publish stage skips AI apply", () => {
    expect(
      resolveOmnibarSubmitRoute({
        stage: "publish",
        selectedSectionCount: 0,
        hasPlanner: true,
        refinableHomeSectionCount: 3,
      }),
    ).toBe("publish_skip");
  });

  it("refine with selection routes to section regeneration", () => {
    expect(
      resolveOmnibarSubmitRoute({
        stage: "refine",
        selectedSectionCount: 2,
        hasPlanner: true,
        refinableHomeSectionCount: 5,
      }),
    ).toBe("refine_sections");
  });

  it("refine without selection prefers light page when home sections are refinable", () => {
    expect(
      resolveOmnibarSubmitRoute({
        stage: "refine",
        selectedSectionCount: 0,
        hasPlanner: true,
        refinableHomeSectionCount: 2,
      }),
    ).toBe("refine_light_page");
  });

  it("refine without selection falls back to heavy path when nothing refinable", () => {
    expect(
      resolveOmnibarSubmitRoute({
        stage: "refine",
        selectedSectionCount: 0,
        hasPlanner: false,
        refinableHomeSectionCount: 0,
      }),
    ).toBe("refine_heavy_page");
  });

  it("review without planner asks for plan first", () => {
    expect(
      resolveOmnibarSubmitRoute({
        stage: "review",
        selectedSectionCount: 0,
        hasPlanner: false,
        refinableHomeSectionCount: 0,
      }),
    ).toBe("review_plan_first");
  });

  it("review with planner runs full build route", () => {
    expect(
      resolveOmnibarSubmitRoute({
        stage: "review",
        selectedSectionCount: 0,
        hasPlanner: true,
        refinableHomeSectionCount: 0,
      }),
    ).toBe("review_full_build");
  });

  it("describe defaults to plan route", () => {
    expect(
      resolveOmnibarSubmitRoute({
        stage: "describe",
        selectedSectionCount: 0,
        hasPlanner: false,
        refinableHomeSectionCount: 0,
      }),
    ).toBe("describe_plan");
  });
});
