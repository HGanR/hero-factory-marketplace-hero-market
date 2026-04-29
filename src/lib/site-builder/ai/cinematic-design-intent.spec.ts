import { describe, expect, it } from "@jest/globals";
import {
  buildCinematicNarrativeEnrichment,
  buildVisualDirectionSummary,
  detectCinematicDesignIntent,
  extractExplicitVisualConstraints,
} from "@/lib/site-builder/ai/cinematic-design-intent";
import { applyCinematicPostProcessToPlannerOutput } from "@/lib/site-builder/ai/cinematic-planner-layer";
import { getRegistryEntry } from "@/lib/site-builder/ai/block-registry";
import { runSitePlanner } from "@/lib/site-builder/ai/planner";
import { intakeToSitePlannerInput } from "@/lib/site-builder/ai/site-builder-intake";
import { mapExecuteIntentMessage } from "@/lib/site-builder/assistant/map-execute-intent-message";
import { generateSiteSchemaFromPlanner } from "@/lib/site-builder/ai/generator";
import { resolveSiteBuilderPreviewBackground } from "@/lib/site-builder/preview/cinematic-preview-background";
import { SiteSchemaDocument } from "@/lib/site-builder/schema";

function sampleSchemaDoc() {
  return SiteSchemaDocument.parse({
    pages: [
      {
        slug: "/",
        blocks: [
          {
            type: "hero",
            content: {
              aiSectionId: "sec-hero-1",
              aiRegistryKey: "hero_primary",
              title: "H",
              subtitle: "S",
            },
          },
        ],
      },
    ],
    metadata: { title: "T", governance: {} },
  });
}

const emptyIntake = {
  businessName: "",
  primaryOffer: "",
  audience: "",
  industry: "",
  market: "",
  additionalNotes: "",
};

describe("detectCinematicDesignIntent", () => {
  it("detects cinematic keywords and mood", () => {
    const r = detectCinematicDesignIntent(
      "Build a cinematic futuristic landing page with neon glow",
      emptyIntake,
      {},
    );
    expect(r.isCinematic).toBe(true);
    expect(r.cinematicIntensity).toBeGreaterThan(0);
    expect(r.visualDirectives.length).toBeGreaterThan(0);
  });
});

describe("extractExplicitVisualConstraints", () => {
  it("parses white background and bold text", () => {
    const v = extractExplicitVisualConstraints("Web3 consulting with white background and bold text");
    expect(v.wantsLightBackground || v.wantsNoDark).toBe(true);
    expect(v.typographyMood).toBe("bold");
  });

  it("detects glow button preference", () => {
    const v = extractExplicitVisualConstraints("Use glowing CTA buttons");
    expect(v.buttonStyle).toBe("glow");
  });
});

describe("buildCinematicNarrativeEnrichment", () => {
  it("appends cinematic directive when keywords fire", () => {
    const out = buildCinematicNarrativeEnrichment(
      "Main brief",
      { ...emptyIntake, additionalNotes: "cinematic immersive hero" },
      {},
      "cinematic immersive hero",
    );
    expect(out).toContain("CINEMATIC DESIGN DIRECTIVE");
  });

  it("intakeToSitePlannerInput embeds directive for the planner (prompt enrichment)", () => {
    const input = intakeToSitePlannerInput(
      {
        businessName: "Acme",
        primaryOffer: "Consulting",
        audience: "Founders",
        industry: "Web3",
        market: "Global",
        additionalNotes: "Cinematic bold landing, immersive and futuristic",
      },
      { siteType: "auto", styleIntensity: 70, web3VisualMode: true, layoutVariantIndex: 0 },
    );
    expect(input.userPrompt).toContain("CINEMATIC DESIGN DIRECTIVE");
  });
});

describe("applyCinematicPostProcessToPlannerOutput", () => {
  it("forces white editorial tokens when user asks for white background + web3", async () => {
    const userPrompt =
      "Web3 consulting landing page with white background and bold text. Blockchain credibility.";
    const { output: base } = await runSitePlanner({
      userPrompt,
      siteType: "web3_product",
      styleIntensity: 70,
      web3VisualMode: true,
    });
    const input = {
      userPrompt,
      siteType: "web3_product" as const,
      styleIntensity: 70,
      web3VisualMode: true,
    };
    const out = applyCinematicPostProcessToPlannerOutput(input, base);
    expect(out.designTokens.backgroundMode).toBe("white-editorial");
    expect(out.sectionPlan[0]?.registryKey).toMatch(/hero_white_editorial|hero_cinematic/);
  });

  it("uses cinematic block registry keys for feature and trust when cinematic", async () => {
    const userPrompt = "Cinematic Web3 product — immersive neon hero with blockchain and wallet flows";
    const { output: base } = await runSitePlanner({
      userPrompt,
      siteType: "web3_product",
      styleIntensity: 80,
      web3VisualMode: true,
    });
    const out = applyCinematicPostProcessToPlannerOutput(
      {
        userPrompt,
        siteType: "web3_product",
        styleIntensity: 80,
        web3VisualMode: true,
      },
      base,
    );
    expect(out.sectionPlan.some((s) => s.registryKey === "feature_bento_glass")).toBe(true);
    expect(getRegistryEntry("feature_bento_glass")).toBeTruthy();
  });
});

describe("buildVisualDirectionSummary", () => {
  it("emits all visualDirection fields", () => {
    const c = detectCinematicDesignIntent("cinematic web3", emptyIntake, { web3VisualMode: true });
    const v = extractExplicitVisualConstraints("white background");
    const r = buildVisualDirectionSummary(
      c,
      v,
      { backgroundMode: "white-editorial", gradientStyle: "soft-mesh" },
      "web3_product",
    );
    expect(r.mood.length).toBeGreaterThan(0);
    expect(r.background.length).toBeGreaterThan(0);
    expect(r.colorPalette.length).toBeGreaterThan(0);
    expect(r.lighting.length).toBeGreaterThan(0);
  });
});

describe("metadata.visualDirection in generated schema", () => {
  it("is present after generateSiteSchemaFromPlanner", async () => {
    const { output } = await runSitePlanner({
      userPrompt: "A cinematic SaaS site",
      siteType: "saas",
      styleIntensity: 60,
      web3VisualMode: false,
    });
    const p = applyCinematicPostProcessToPlannerOutput(
      { userPrompt: "A cinematic SaaS site", siteType: "saas", styleIntensity: 60, web3VisualMode: false },
      output,
    );
    const schema = generateSiteSchemaFromPlanner(p, "t1", {
      plannerInput: { userPrompt: "A cinematic SaaS site", siteType: "saas", styleIntensity: 60, web3VisualMode: false },
    });
    const doc = SiteSchemaDocument.safeParse(schema);
    expect(doc.success).toBe(true);
    const vd = doc.data?.metadata?.visualDirection;
    expect(vd?.mood).toBeDefined();
    expect(vd?.background).toBeDefined();
  });
});

describe("resolveSiteBuilderPreviewBackground", () => {
  it("white editorial does not resolve to a dark only-slate background", () => {
    const bg = resolveSiteBuilderPreviewBackground({
      backgroundMode: "white-editorial",
      gradientStart: "#fff",
      gradientEnd: "#fff",
      customGradient: "",
      backgroundColor: "#fff",
      gradientStyle: "soft-mesh",
    });
    expect(bg).toMatch(/#fff|#f8fafc|#f1f5f9|255/i);
  });
});

describe("mapExecuteIntentMessage cinematic", () => {
  it("maps make it cinematic to token fields", () => {
    const out = mapExecuteIntentMessage({
      message: "make it cinematic",
      schema: sampleSchemaDoc(),
      editContext: { lastPageSlug: "/", lastSectionIds: [] },
    });
    const t = out.actions.find((a) => a.action === "set_theme_tokens");
    expect(t).toBeDefined();
    if (t?.action === "set_theme_tokens") {
      expect(t.backgroundMode).toBe("holographic-gradient");
      expect(t.buttonStyle).toBe("glow");
    }
  });

  it("maps make the background to white to preview-consumed custom_color", () => {
    const out = mapExecuteIntentMessage({
      message: "make the background white",
      schema: sampleSchemaDoc(),
      editContext: { lastPageSlug: "/", lastSectionIds: [] },
    });
    const t = out.actions.find((a) => a.action === "set_theme_tokens");
    expect(t?.action).toBe("set_theme_tokens");
    if (t?.action === "set_theme_tokens") {
      expect(t.backgroundMode).toBe("custom_color");
      expect(t.backgroundColor).toBe("#ffffff");
    }
  });
});
