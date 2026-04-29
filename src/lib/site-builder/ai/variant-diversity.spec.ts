import { describe, expect, it } from "@jest/globals";
import {
  computeRegistryKeySignature,
  computeSectionOrderSignature,
  computeVariantDiversityScore,
  scoreVariantSetDiversity,
} from "@/lib/site-builder/ai/variant-diversity";

function schema(keys: string[]) {
  return {
    pages: [
      {
        slug: "/",
        blocks: keys.map((k, i) => ({ type: k.includes("hero") ? "hero" : "section", content: { aiRegistryKey: k, order: i } })),
      },
    ],
  };
}

describe("variant diversity scoring", () => {
  it("identical variants score low diversity", () => {
    const a = schema(["hero_primary", "trust_strip", "value_props", "mid_cta"]);
    const b = schema(["hero_primary", "trust_strip", "value_props", "mid_cta"]);
    expect(computeSectionOrderSignature(a)).toBe(computeSectionOrderSignature(b));
    expect(computeRegistryKeySignature(a)).toBe(computeRegistryKeySignature(b));
    expect(computeVariantDiversityScore(a, b)).toBeLessThan(0.05);
  });

  it("different structures score higher diversity", () => {
    const a = schema(["hero_primary_split", "trust_strip", "value_props", "mid_cta", "faq"]);
    const b = schema(["hero_primary_neural", "web3_ribbon", "feature_grid", "pricing_cinematic_cards", "cta_glow_panel"]);
    expect(computeVariantDiversityScore(a, b)).toBeGreaterThan(0.35);
  });

  it("variant set score averages pair diversity", () => {
    const a = schema(["hero_primary_split", "trust_strip", "value_props", "mid_cta"]);
    const b = schema(["hero_primary_neural", "feature_grid", "social_proof", "cta_glow_panel"]);
    const c = schema(["hero_primary_grid", "paragraph_intro", "stat_band", "mid_cta", "faq"]);
    expect(scoreVariantSetDiversity([a, b, c])).toBeGreaterThan(0.2);
  });

  it("visual metadata differences boost diversity between otherwise-similar schemas", () => {
    const baseKeys = ["hero_primary_split", "trust_strip", "value_props", "mid_cta"];
    const a = schema(baseKeys) as {
      pages: Array<{ blocks: Array<{ type?: string; content?: Record<string, unknown> }> }>;
      metadata?: Record<string, unknown>;
    };
    const b = schema(baseKeys) as typeof a;
    a.metadata = {
      visualMeta: {
        layoutFamilyId: "editorial_story",
        gradientStyle: "linear",
        backgroundStyle: "solid",
        lightingStyle: "soft",
      },
    };
    b.metadata = {
      visualMeta: {
        layoutFamilyId: "web3_immersive",
        gradientStyle: "neon",
        backgroundStyle: "gradient",
        lightingStyle: "neon-glow",
      },
    };
    const heroA = a.pages[0]!.blocks[0]!.content ?? {};
    const heroB = b.pages[0]!.blocks[0]!.content ?? {};
    heroA.visual = { gradient: "linear-gradient(135deg, #0f172a, #1e293b)" };
    heroB.visual = {
      gradient: "radial-gradient(circle at 10% 10%, #22d3ee, transparent 40%), linear-gradient(135deg, #020617, #4c1d95)",
    };

    const withoutVisual = computeVariantDiversityScore(schema(baseKeys), schema(baseKeys));
    const withVisual = computeVariantDiversityScore(a, b);
    expect(withVisual).toBeGreaterThan(withoutVisual);
  });
});
