import { describe, expect, it } from "@jest/globals";
import {
  briefFingerprint,
  composeAuxiliaryPagePlan,
  composeHomeSectionPlan,
  composeSitemap,
  inferSectionRoleForRegistryKey,
} from "@/lib/site-builder/ai/section-composition";
import { SitePlannerOutputSchema } from "@/lib/site-builder/ai/schemas";

describe("section composition (bespoke, deterministic)", () => {
  it("briefFingerprint is stable for the same string", () => {
    expect(briefFingerprint("acme dental hours and booking")).toBe(briefFingerprint("acme dental hours and booking"));
  });

  it("composeHomeSectionPlan varies by intent (saas vs portfolio first metrics cluster)", () => {
    const saas = composeHomeSectionPlan("saas", "corporate", false, "B2B analytics for product teams");
    const portfolio = composeHomeSectionPlan("portfolio", "corporate", false, "Photographer portfolio for editorial clients");
    expect(saas[0]?.registryKey).toMatch(/^hero_primary/);
    expect(portfolio[0]?.registryKey).toBe("hero_primary_holographic");
    const saasKeys = saas.map((s) => s.registryKey).join(",");
    const portKeys = portfolio.map((s) => s.registryKey).join(",");
    expect(saasKeys).not.toBe(portKeys);
  });

  it("styleMode minimal yields a shorter plan than bold for same intent", () => {
    const minimal = composeHomeSectionPlan("landing", "minimal", false, "SaaS landing for calendar scheduling");
    const bold = composeHomeSectionPlan("landing", "bold", false, "SaaS landing for calendar scheduling");
    expect(minimal.length).toBeLessThanOrEqual(bold.length);
  });

  it("layout family changes deterministic section structure", () => {
    const a = composeHomeSectionPlan(
      "saas",
      "corporate",
      false,
      "AI CRM for operators",
      0,
      "split_authority",
    );
    const b = composeHomeSectionPlan(
      "saas",
      "corporate",
      false,
      "AI CRM for operators",
      0,
      "conversion_funnel",
    );
    expect(a.map((r) => r.registryKey).join(",")).not.toBe(b.map((r) => r.registryKey).join(","));
  });

  it("split_authority places trust strip immediately after hero", () => {
    const plan = composeHomeSectionPlan("saas", "corporate", false, "Trust-led consulting", 0, "split_authority");
    expect(plan[0]?.registryKey).toMatch(/^hero_/);
    expect(plan[1]?.registryKey).toMatch(/trust_strip|trust_network/);
  });

  it("conversion_funnel keeps first CTA after proof and pricing (registry order)", () => {
    const plan = composeHomeSectionPlan("saas", "corporate", false, "SaaS checkout", 0, "conversion_funnel");
    const keys = plan.map((r) => r.registryKey);
    const firstCta = keys.findIndex((k) => k === "mid_cta" || k === "cta_glow_panel" || k === "pricing_cinematic_cards");
    const proofIdx = keys.findIndex((k) => k === "social_proof" || k === "web3_proof_network");
    expect(proofIdx).toBeGreaterThanOrEqual(0);
    expect(firstCta).toBeGreaterThan(proofIdx);
  });

  it("assigns sectionRole on every composed home row", () => {
    const plan = composeHomeSectionPlan("landing", "bold", false, "Bold consumer app", 0, "product_showcase");
    expect(plan.length).toBeGreaterThan(3);
    expect(plan.every((r) => Boolean(r.sectionRole))).toBe(true);
    expect(plan[0]?.sectionRole).toBe("hero");
    expect(inferSectionRoleForRegistryKey("trust_strip")).toBe("trust");
  });

  it("composeSitemap adds contact for local_business intent", () => {
    const sm = composeSitemap("Joe's Cafe", "local_business", "Neighborhood cafe with brunch and catering");
    expect(sm[0]?.slug).toBe("/");
    const slugs = sm.map((s) => s.slug);
    expect(slugs).toContain("/contact");
  });

  it("composeAuxiliaryPagePlan /about differs from /offer", () => {
    const planner = SitePlannerOutputSchema.parse({
      version: 1,
      intent: "saas",
      normalizedBrief: "Analytics for product teams",
      sitemap: [{ slug: "/", title: "Home", purpose: "Landing" }],
      sectionPlan: [
        { id: "sec_hero", registryKey: "hero_primary_glow" },
        { id: "sec_foot", registryKey: "footer_standard" },
      ],
      designTokens: { styleMode: "corporate" },
      brandVoice: { tone: "Crisp", keywords: ["analytics"] },
      conversionGoal: "Book demo",
    });
    const about = composeAuxiliaryPagePlan("/about", "Story", planner, "corporate", "t1");
    const offer = composeAuxiliaryPagePlan("/offer", "Plans", planner, "corporate", "t1");
    expect(about.map((r) => r.registryKey).join(",")).not.toBe(offer.map((r) => r.registryKey).join(","));
  });
});
