import { describe, expect, it } from "@jest/globals";
import {
  chunkSectionIdsForBatch,
  listRefinableSectionIdsOnPage,
  shouldPreferLightPageRefinement,
} from "@/lib/site-builder/site-builder-light-page";

const SCHEMA_WITH_HOME = JSON.stringify({
  pages: [
    {
      slug: "/",
      blocks: [
        {
          type: "hero",
          content: { aiSectionId: "s1", aiRegistryKey: "hero.v1", title: "Hi" },
        },
        {
          type: "text",
          content: { aiSectionId: "s2", body: "x" },
        },
        {
          type: "cta",
          content: { aiSectionId: "s3", aiRegistryKey: "cta.v1", label: "Go" },
        },
      ],
    },
  ],
});

describe("site-builder-light-page", () => {
  it("lists only blocks with both aiSectionId and aiRegistryKey on home", () => {
    expect(listRefinableSectionIdsOnPage(SCHEMA_WITH_HOME)).toEqual(["s1", "s3"]);
  });

  it("chunks section ids with cap 3", () => {
    expect(chunkSectionIdsForBatch(["a", "b", "c", "d", "e"])).toEqual([
      ["a", "b", "c"],
      ["d", "e"],
    ]);
  });

  it("shouldPreferLightPageRefinement mirrors refinable count", () => {
    expect(shouldPreferLightPageRefinement(0)).toBe(false);
    expect(shouldPreferLightPageRefinement(1)).toBe(true);
  });
});
