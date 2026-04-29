import type { BuilderAction } from "@/lib/site-builder/builder-actions/action-schemas";
import { builderActionTouchSectionIds } from "@/lib/site-builder/assistant/builder-action-touch-ids";

describe("builderActionTouchSectionIds", () => {
  it("collects regenerate and update_copy targets", () => {
    const actions: BuilderAction[] = [
      { action: "set_theme_tokens", styleMode: "minimal" },
      { action: "regenerate_section", sectionId: "a", instruction: "x" },
      { action: "update_copy", pageSlug: "/", aiSectionId: "b", patches: { title: "t" } },
    ];
    expect(builderActionTouchSectionIds(actions).sort()).toEqual(["a", "b"]);
  });
});
