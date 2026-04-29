import { describe, expect, it } from "@jest/globals";
import { chooseVariantLayoutFamilies, getLayoutFamilyById, LAYOUT_FAMILIES } from "@/lib/site-builder/ai/layout-families";
import { SitePlannerInputSchema } from "@/lib/site-builder/ai/schemas";

describe("layout families", () => {
  it("assigns unique families for 3 variants", () => {
    const out = chooseVariantLayoutFamilies(3, "seed-abc");
    expect(out).toHaveLength(3);
    const ids = out.map((f) => f.id);
    expect(new Set(ids).size).toBe(3);
  });

  it("exposes known family ids", () => {
    expect(getLayoutFamilyById("web3_immersive")?.label).toContain("Web3");
    expect(LAYOUT_FAMILIES.length).toBeGreaterThanOrEqual(8);
  });

  it("planner input accepts layout family fields", () => {
    const parsed = SitePlannerInputSchema.parse({
      userPrompt: "Build me a site",
      siteType: "auto",
      styleIntensity: 60,
      web3VisualMode: false,
      layoutFamilyId: "split_authority",
      variantIntent: "Proof-led layout",
    });
    expect(parsed.layoutFamilyId).toBe("split_authority");
    expect(parsed.variantIntent).toBe("Proof-led layout");
  });

  it("biases to split_authority when inspiration suggests early trust or proof", () => {
    const out = chooseVariantLayoutFamilies(1, "x", {
      layoutPatterns: ["A proof section appears before service details"],
      sectionPatterns: ["Trust band near the first fold"],
    });
    expect(out[0]!.id).toBe("split_authority");
  });

  it("biases to web3_immersive from planner input signals", () => {
    const input = SitePlannerInputSchema.parse({
      userPrompt: "Protocol landing",
      siteType: "web3_product",
      styleIntensity: 60,
      web3VisualMode: true,
    });
    const out = chooseVariantLayoutFamilies(1, "seed", undefined, input);
    expect(out[0]!.id).toBe("web3_immersive");
  });
});
