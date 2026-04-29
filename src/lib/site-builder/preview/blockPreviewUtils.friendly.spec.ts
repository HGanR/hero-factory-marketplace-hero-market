import { describe, expect, it } from "@jest/globals";
import { friendlyLabelsForSectionIds, sectionTypeToFriendlyLabel } from "@/lib/site-builder/preview/blockPreviewUtils";

describe("blockPreviewUtils friendly labels", () => {
  it("sectionTypeToFriendlyLabel maps common blocks", () => {
    expect(sectionTypeToFriendlyLabel("hero")).toBe("Hero");
    expect(sectionTypeToFriendlyLabel("call_to_action")).toBe("CTA");
  });

  it("friendlyLabelsForSectionIds resolves from home page blocks", () => {
    const schema = JSON.stringify({
      pages: [
        {
          slug: "/",
          blocks: [
            { type: "hero", content: { aiSectionId: "s1", title: "H" } },
            { type: "call_to_action", content: { aiSectionId: "s2", title: "C" } },
          ],
        },
      ],
    });
    expect(friendlyLabelsForSectionIds(schema, ["s1", "s2"])).toEqual(["Hero", "CTA"]);
  });
});
