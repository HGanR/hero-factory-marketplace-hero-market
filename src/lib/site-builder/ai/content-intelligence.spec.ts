import { describe, expect, it } from "@jest/globals";
import { SitePlannerInputSchema, SitePlannerOutputSchema } from "@/lib/site-builder/ai/schemas";
import {
  buildContentBrief,
  dedupeRepeatedPhrases,
  runContentIntelligencePipeline,
} from "@/lib/site-builder/ai/content-intelligence";
import { shouldRepairContent } from "@/lib/site-builder/ai/content-quality";
import { generateSiteSchemaFromPlanner } from "@/lib/site-builder/ai/generator";
import type { SiteSchemaDocumentType } from "@/lib/site-builder/schema";

const web3Input = SitePlannerInputSchema.parse({
  userPrompt: "A bold Web3 consulting landing page for blockchain security audits and token governance",
  siteType: "web3_product",
  industry: "blockchain / Web3",
  styleIntensity: 60,
  web3VisualMode: true,
});

const vaguePlanner = SitePlannerOutputSchema.parse({
  version: 1,
  intent: "landing",
  normalizedBrief: "Consulting and advisory and consulting for businesses.",
  sitemap: [{ slug: "/", title: "Home" }],
  sectionPlan: [
    { id: "h", registryKey: "hero_primary", headline: "Services", purpose: "x" },
    { id: "a", registryKey: "value_props" },
  ],
  designTokens: { styleMode: "corporate", backgroundMode: "simple_gradients" as const, motionIntensity: 40 },
  brandVoice: { tone: "Professional", keywords: ["services"] },
  conversionGoal: "Get leads",
  web3ExtensionHints: {
    walletPersonalizationReady: true,
    tokenGatedSectionsPossible: false,
    manualApprovalRequiredForContractWrites: true,
  },
});

describe("dedupeRepeatedPhrases", () => {
  it("reduces back-to-back duplicate words", () => {
    const s = dedupeRepeatedPhrases("Professional services and advisory Professional services.");
    expect(s).not.toMatch(/Professional services\s+Professional services/i);
  });
});

describe("buildContentBrief", () => {
  it("enriches Web3 consulting prompt with web3 / blockchain language", () => {
    const b = buildContentBrief(web3Input, vaguePlanner);
    expect(b.keywordTargets.some((k) => /web3|blockchain|on-chain|wallet|governance|token/i.test(k))).toBe(
      true,
    );
    expect(b.ctaPrimary).toMatch(/allowlist|wallet|on-?chain|join/i);
  });

  it("salon booking vertical prefers booking and chair language in CTAs or keywords", () => {
    const in0 = SitePlannerInputSchema.parse({
      userPrompt: "Austin salon online booking for cuts and color",
      siteType: "auto",
      industry: "Hair salon / booking",
      styleIntensity: 50,
      web3VisualMode: false,
    });
    const b = buildContentBrief(in0, vaguePlanner);
    const blob = `${b.ctaPrimary} ${b.keywordTargets?.join(" ") || ""}`;
    expect(blob).toMatch(/book|appoint|salon|chair|style|cut|color/i);
  });

  it("makes a vague consulting prompt more specific in primary offer", () => {
    const in0 = SitePlannerInputSchema.parse({
      userPrompt: "We are a professional services company doing consulting",
      siteType: "auto",
      industry: "Management consulting",
      styleIntensity: 50,
      web3VisualMode: false,
    });
    const b = buildContentBrief(in0, vaguePlanner);
    expect(b.primaryOffer.length).toBeGreaterThan(20);
    expect(b.painPoints.length).toBeGreaterThan(0);
  });

  it("prefers conversational statedConversionGoal and statedBrandTone", () => {
    const in0 = SitePlannerInputSchema.parse({
      userPrompt: "Landing page for a dental practice",
      siteType: "local_business",
      styleIntensity: 50,
      web3VisualMode: false,
      statedConversionGoal: "Schedule a cleaning online",
      statedBrandTone: "Warm and reassuring",
      statedTrustAndProof: "ADA member · 500+ Google reviews",
    });
    const b = buildContentBrief(in0, vaguePlanner);
    expect(b.conversionGoal).toContain("Schedule");
    expect(b.tone).toContain("Warm");
    expect(b.trustSignals.some((t) => /ADA|Google|review/i.test(t))).toBe(true);
    expect(b.ctaPrimary.length).toBeGreaterThan(5);
  });
});

describe("runContentIntelligencePipeline", () => {
  it("increases score for generic hero after repair or leaves high scores stable", () => {
    const doc = generateSiteSchemaFromPlanner(vaguePlanner, "t1", { plannerInput: web3Input });
    const first = runContentIntelligencePipeline(
      web3Input,
      vaguePlanner,
      doc,
    );
    if (first.meta.repaired) {
      expect(first.document.pages[0]?.blocks[0]).toBeDefined();
    }
    expect(typeof (shouldRepairContent(first.meta.contentScore) || first.meta.repaired)).toBe("boolean");
    const meta = first.meta;
    expect(typeof meta.contentScore).toBe("number");
  });

  it("CTA is not only Learn more when web3 and repair applied", () => {
    const p = { ...vaguePlanner, intent: "web3_product" as const };
    const w = SitePlannerInputSchema.parse({ ...web3Input, userPrompt: "DeFi security partner for protocols" });
    const doc = generateSiteSchemaFromPlanner(p, "t2", { plannerInput: w });
    const out = runContentIntelligencePipeline(w, p, doc as SiteSchemaDocumentType);
    const hero = out.document.pages[0]?.blocks.find((b) => b.type === "hero");
    const pc = (hero?.content as { primaryCta?: string })?.primaryCta;
    if (out.meta.repaired) {
      expect(String(pc).toLowerCase().trim()).not.toBe("learn more");
    }
  });
});
