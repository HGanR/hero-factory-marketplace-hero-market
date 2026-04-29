import { extractSectionRegistryKeys } from "@/lib/site-builder/intelligence/extract-schema-metadata";
import type { SitePlannerOutput } from "@/lib/site-builder/ai/schemas";

describe("extractSectionRegistryKeys", () => {
  it("returns ordered registry keys from sectionPlan", () => {
    const planner = {
      sectionPlan: [
        { id: "1", registryKey: "hero_primary" },
        { id: "2", registryKey: "footer_standard" },
      ],
    } as unknown as SitePlannerOutput;
    expect(extractSectionRegistryKeys(planner)).toEqual(["hero_primary", "footer_standard"]);
  });

  it("filters empty keys", () => {
    const planner = {
      sectionPlan: [{ id: "1", registryKey: "  " }, { id: "2", registryKey: "mid_cta" }],
    } as unknown as SitePlannerOutput;
    expect(extractSectionRegistryKeys(planner)).toEqual(["mid_cta"]);
  });
});
