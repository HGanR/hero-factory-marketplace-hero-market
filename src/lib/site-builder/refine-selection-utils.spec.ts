import { describe, expect, it } from "@jest/globals";
import {
  compactSectionIdPrefixes,
  filterSectionIdsStillInSchema,
  normalizeRefineSectionIds,
  parseAiSectionIdsFromSchemaJson,
} from "./refine-selection-utils";

describe("refine-selection-utils", () => {
  it("normalizeRefineSectionIds dedupes, preserves order, caps at 3", () => {
    expect(normalizeRefineSectionIds(["a", "b", "a", "c", "d"])).toEqual(["a", "b", "c"]);
    expect(normalizeRefineSectionIds(["  x ", "y"])).toEqual(["x", "y"]);
  });

  it("parseAiSectionIdsFromSchemaJson walks pages and blocks", () => {
    const json = JSON.stringify({
      pages: [{ blocks: [{ content: { aiSectionId: "s1" } }, { content: { aiSectionId: "s2" } }] }],
    });
    expect(parseAiSectionIdsFromSchemaJson(json)).toEqual(["s1", "s2"]);
  });

  it("filterSectionIdsStillInSchema keeps order and drops missing", () => {
    const json = JSON.stringify({
      pages: [{ blocks: [{ content: { aiSectionId: "keep" } }] }],
    });
    expect(filterSectionIdsStillInSchema(json, ["keep", "gone", "keep"])).toEqual(["keep"]);
  });

  it("compactSectionIdPrefixes joins short prefixes", () => {
    expect(compactSectionIdPrefixes(["abcdefgh", "xyz"])).toBe("abcdefgh|xyz");
  });
});
