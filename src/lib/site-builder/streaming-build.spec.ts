import { describe, expect, it } from "@jest/globals";
import type { SitePlannerInput } from "@/lib/site-builder/ai/schemas";
import {
  applyStreamingBuildPhasePatch,
  createInstantSkeletonSchema,
} from "@/lib/site-builder/streaming-build";

const sampleInput: SitePlannerInput = {
  userPrompt: "Build a fast site",
  siteType: "landing",
  styleIntensity: 55,
  web3VisualMode: false,
  businessName: "Acme Growth",
  primaryOffer: "Pipeline acceleration",
  audience: "B2B operators",
  industry: "SaaS consulting",
};

describe("streaming-build", () => {
  it("creates an instant skeleton schema with multiple sections", () => {
    const s = createInstantSkeletonSchema(sampleInput);
    const home = s.pages.find((p) => p.slug === "/");
    expect(home?.blocks?.length).toBeGreaterThanOrEqual(4);
    expect(String(home?.blocks?.[0]?.type)).toBe("hero");
  });

  it("applies incremental content patching across phases", () => {
    const s0 = createInstantSkeletonSchema(sampleInput);
    const s1 = applyStreamingBuildPhasePatch(s0, "content", sampleInput);
    const s2 = applyStreamingBuildPhasePatch(s1, "design", sampleInput);

    const hero1 = s1.pages[0]?.blocks[0]?.content as { title?: string; primaryCta?: string };
    expect(String(hero1?.title || "")).toMatch(/helps|Pipeline/i);
    expect(String(hero1?.primaryCta || "")).toMatch(/Book|Join|Get/i);

    const hero2 = s2.pages[0]?.blocks[0]?.content as { style?: { backgroundColor?: string } };
    expect(String(hero2?.style?.backgroundColor || "")).toMatch(/^#/);
  });
});
