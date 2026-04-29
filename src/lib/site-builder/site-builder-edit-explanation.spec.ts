import { describe, expect, it } from "@jest/globals";
import { buildSiteBuilderEditExplanation } from "@/lib/site-builder/site-builder-edit-explanation";

describe("site-builder-edit-explanation", () => {
  it("single section with label", () => {
    expect(
      buildSiteBuilderEditExplanation({
        command: "softer CTA",
        scope: "section",
        friendlyLabels: ["Hero"],
      }),
    ).toContain("hero");
  });

  it("design token without friendly label", () => {
    expect(
      buildSiteBuilderEditExplanation({
        command: "navy and gold",
        scope: "section",
        friendlyLabels: [],
        editMeta: { primaryIntent: "design_token_update" },
      }),
    ).toContain("design tokens");
  });

  it("multi-section with count", () => {
    const s = buildSiteBuilderEditExplanation({
      command: "tighten copy",
      scope: "multi_section",
      friendlyLabels: ["Hero", "CTA", "Footer"],
      sectionCount: 3,
    });
    expect(s).toContain("3");
  });

  it("light page", () => {
    expect(
      buildSiteBuilderEditExplanation({
        command: "warmer tone",
        scope: "light_page",
        sectionCount: 4,
      }),
    ).toContain("4");
  });

  it("full page", () => {
    expect(
      buildSiteBuilderEditExplanation({
        command: "new positioning",
        scope: "full_page",
      }),
    ).toContain("Rebuilt");
  });

  it("plan", () => {
    expect(buildSiteBuilderEditExplanation({ command: "SaaS trust page", scope: "plan" })).toContain("plan");
  });

  it("sparse fallback", () => {
    expect(buildSiteBuilderEditExplanation({ command: "", scope: "section", friendlyLabels: [] })).toBe("Applied your update.");
  });
});
