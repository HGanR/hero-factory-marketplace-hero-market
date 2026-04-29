import {
  buildVariantPickerItems,
  extractSiteVariantPreviewMeta,
  pickSchemaForVariantIndex,
} from "@/lib/site-builder/variant-picker-meta";

describe("extractSiteVariantPreviewMeta", () => {
  it("reads hero title and registry keys", () => {
    const doc = {
      pages: [
        {
          slug: "/",
          blocks: [
            {
              type: "hero",
              content: { aiRegistryKey: "hero_primary", title: "Tax clarity for founders", subtitle: "x" },
            },
            { type: "section", content: { aiRegistryKey: "value_props", title: "Why us" } },
          ],
        },
      ],
    };
    const m = extractSiteVariantPreviewMeta(doc, { layoutFamilyId: "split_authority" });
    expect(m.heroHeadline).toBe("Tax clarity for founders");
    expect(m.homeSectionCount).toBe(2);
    expect(m.registryKeys).toEqual(["hero_primary", "value_props"]);
    expect(m.layoutFamilyLabel).toContain("Split Authority");
    expect(m.firstSectionTypes).toEqual(["hero_primary", "value_props"]);
  });

  it("handles empty schema", () => {
    const m = extractSiteVariantPreviewMeta({});
    expect(m.heroHeadline).toBe("—");
    expect(m.homeSectionCount).toBe(0);
    expect(m.layoutFamilyLabel).toBe("Auto family");
  });
});

describe("pickSchemaForVariantIndex", () => {
  it("returns primary for 0 and alternates for 1+", () => {
    const p = { id: "p" };
    const alts = [
      { seed: "a", schema: { id: "b" } },
      { seed: "b", schema: { id: "c" } },
    ];
    expect(pickSchemaForVariantIndex(p, alts, 0)).toBe(p);
    expect(pickSchemaForVariantIndex(p, alts, 1)).toEqual({ id: "b" });
    expect(pickSchemaForVariantIndex(p, alts, 2)).toEqual({ id: "c" });
    expect(pickSchemaForVariantIndex(p, alts, 99)).toBeNull();
  });
});

describe("buildVariantPickerItems", () => {
  it("builds A + B + C for primary and two alternates", () => {
    const items = buildVariantPickerItems({ a: 1 }, [
      { seed: "s1", schema: { b: 2 } },
      { seed: "s2", schema: { c: 3 } },
    ], { layoutFamilyId: "cinematic_hero_journey" });
    expect(items.map((i) => i.label)).toEqual(["Layout A", "Layout B", "Layout C"]);
    expect(items.map((i) => i.index)).toEqual([0, 1, 2]);
    expect(items[0]?.generationMeta?.layoutFamilyId).toBe("cinematic_hero_journey");
  });
});
