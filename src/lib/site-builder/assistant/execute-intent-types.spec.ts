import type { BuilderAction } from "@/lib/site-builder/builder-actions/action-schemas";
import { classifyIntentFromActions } from "@/lib/site-builder/assistant/execute-intent-types";

describe("classifyIntentFromActions", () => {
  it("classifies style + regen as multi", () => {
    const actions: BuilderAction[] = [
      { action: "set_theme_tokens", styleMode: "minimal" },
      { action: "regenerate_section", sectionId: "x", instruction: "go" },
    ];
    expect(classifyIntentFromActions(actions)).toBe("multi");
  });

  it("classifies import", () => {
    const actions: BuilderAction[] = [{ action: "import_blueprint_from_url", url: "https://a.com" }];
    expect(classifyIntentFromActions(actions)).toBe("import");
  });

  it("returns unclear for empty", () => {
    expect(classifyIntentFromActions([])).toBe("unclear");
  });
});
