import { describe, expect, it } from "@jest/globals";
import {
  buildNarrativeFromIntake,
  getNextConversationalIntakeStep,
  hashPipelineInputPayload,
  intakeToSitePlannerInput,
  validateIntakeForFullBuild,
} from "@/lib/site-builder/ai/site-builder-intake";
import type { SitePlannerInput } from "@/lib/site-builder/ai/schemas";

describe("site-builder intake", () => {
  const emptyEx = {
    industry: "",
    market: "",
    additionalNotes: "",
    conversionGoal: "",
    brandTone: "",
    designPreference: "",
    inspirationWebsites: "",
    trustAndProof: "",
  };

  it("validates full build requires business, offer, audience", () => {
    const bad = validateIntakeForFullBuild({
      businessName: "",
      primaryOffer: "x",
      audience: "y",
      ...emptyEx,
    });
    expect(bad.ok).toBe(false);
    const ok = validateIntakeForFullBuild({
      businessName: "A",
      primaryOffer: "B",
      audience: "C",
      ...emptyEx,
    });
    expect(ok.ok).toBe(true);
  });

  it("allows prompt-only full build when additional notes are long enough", () => {
    const prompt = "Build me a consulting firm landing page with services and contact.";
    expect(prompt.length).toBeGreaterThanOrEqual(24);
    const onlyPrompt = validateIntakeForFullBuild({
      businessName: "",
      primaryOffer: "",
      audience: "",
      industry: "",
      market: "",
      additionalNotes: prompt,
    });
    expect(onlyPrompt.ok).toBe(true);
    const tooShort = validateIntakeForFullBuild({
      businessName: "",
      primaryOffer: "",
      audience: "",
      industry: "",
      market: "",
      additionalNotes: "short",
    });
    expect(tooShort.ok).toBe(false);
  });

  it("prompt-only full build still requires hub client when build-for-client is on", () => {
    const prompt = "Build me a consulting firm landing page with services and contact.";
    const missing = validateIntakeForFullBuild(
      {
        businessName: "",
        primaryOffer: "",
        audience: "",
        ...emptyEx,
        additionalNotes: prompt,
      },
      { buildForClient: true, revenueOsClientId: "" },
    );
    expect(missing.ok).toBe(false);
  });

  it("full build with build-for-client requires hub client id", () => {
    const intake = {
      businessName: "A",
      primaryOffer: "B",
      audience: "C",
      ...emptyEx,
    };
    const missingClient = validateIntakeForFullBuild(intake, { buildForClient: true, revenueOsClientId: "" });
    expect(missingClient.ok).toBe(false);
    const withClient = validateIntakeForFullBuild(intake, {
      buildForClient: true,
      revenueOsClientId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    });
    expect(withClient.ok).toBe(true);
    const offMode = validateIntakeForFullBuild(intake, { buildForClient: false, revenueOsClientId: "" });
    expect(offMode.ok).toBe(true);
  });

  it("buildNarrativeFromIntake includes structured parts", () => {
    const t = buildNarrativeFromIntake({
      businessName: "Acme",
      primaryOffer: "Plumbing",
      audience: "Homeowners",
      industry: "Trades",
      market: "Seattle",
      additionalNotes: "Urgent",
      conversionGoal: "Book a visit",
      brandTone: "Friendly",
      designPreference: "Clean",
      inspirationWebsites: "",
      trustAndProof: "Licensed & insured",
    });
    expect(t).toContain("## Acme");
    expect(t).toContain("Plumbing");
    expect(t).toContain("Seattle");
    expect(t).toMatch(/Book a visit/);
    expect(t).toMatch(/Licensed/);
  });

  it("intakeToSitePlannerInput passes stated fields for pipeline", () => {
    const out = intakeToSitePlannerInput(
      {
        businessName: "X",
        primaryOffer: "Y",
        audience: "Z",
        industry: "",
        market: "",
        additionalNotes: " ",
        conversionGoal: "Get a quote",
        brandTone: "Formal",
        designPreference: "Minimal",
        inspirationWebsites: "",
        trustAndProof: "10 years in business",
      },
      { siteType: "auto", styleIntensity: 55, web3VisualMode: false, layoutVariantIndex: 0 },
    );
    expect(out.statedConversionGoal).toBe("Get a quote");
    expect(out.statedBrandTone).toBe("Formal");
    expect(out.statedTrustAndProof).toContain("10 years");
  });

  it("getNextConversationalIntakeStep walks questions in order; skip advances", () => {
    expect(getNextConversationalIntakeStep({}, [])?.key).toBe("businessName");
    expect(getNextConversationalIntakeStep({ businessName: "Acme" }, [])?.key).toBe("industry");
    expect(getNextConversationalIntakeStep({ businessName: "A" }, ["industry"])?.key).toBe("primaryOffer");
    const all: Record<string, string> = {
      businessName: "A",
      industry: "B",
      primaryOffer: "C",
      audience: "D",
      conversionGoal: "E",
      brandTone: "F",
      designPreference: "G",
      inspirationWebsites: "H",
      trustAndProof: "I",
    };
    expect(getNextConversationalIntakeStep(all, [])).toBeNull();
  });

  it("hashPipelineInputPayload is stable for the same input", () => {
    const a: SitePlannerInput = {
      userPrompt: "hello",
      siteType: "auto",
      styleIntensity: 55,
      web3VisualMode: false,
      layoutVariantIndex: 2,
    };
    expect(hashPipelineInputPayload(a)).toBe(hashPipelineInputPayload({ ...a }));
  });
});
