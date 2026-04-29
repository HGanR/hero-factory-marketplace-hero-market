import { describe, expect, it } from "@jest/globals";
import { isRefineStage, resolveRefinePrimaryCommandScope } from "@/lib/site-builder/site-builder-primary-command";

describe("site-builder-primary-command", () => {
  it("resolveRefinePrimaryCommandScope uses section path when any section selected", () => {
    expect(resolveRefinePrimaryCommandScope(1)).toBe("selected_sections");
    expect(resolveRefinePrimaryCommandScope(3)).toBe("selected_sections");
  });

  it("resolveRefinePrimaryCommandScope uses full page when none selected", () => {
    expect(resolveRefinePrimaryCommandScope(0)).toBe("full_page");
  });

  it("isRefineStage matches refine only", () => {
    expect(isRefineStage("refine")).toBe(true);
    expect(isRefineStage("describe")).toBe(false);
  });
});
