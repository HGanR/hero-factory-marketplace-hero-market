import { describe, expect, it } from "@jest/globals";
import { generateSiteSchemaFromPlanner } from "@/lib/site-builder/ai/generator";
import { runSitePlanner } from "@/lib/site-builder/ai/planner";
import { generateStaticBundle } from "@/lib/site-builder/static-generator";
import { SiteSchemaDocument } from "@/lib/site-builder/schema";
import { executeBuilderActions } from "@/lib/site-builder/builder-actions/execute-builder-actions";
import { mapExecuteIntentMessage } from "@/lib/site-builder/assistant/map-execute-intent-message";
import {
  applySeoIntelligenceToDocument,
  buildStructuredDataJsonLd,
  extractSeoIntent,
  generateSeoMetadata,
  validateSeoQuality,
} from "@/lib/site-builder/seo/seo-intelligence";

describe("extractSeoIntent", () => {
  it("extracts Web3 consulting style intent and keywords", () => {
    const r = extractSeoIntent({
      userPrompt: "web3 consulting firm for enterprise wallets and token launches",
      siteType: "web3_product",
      styleIntensity: 60,
      web3VisualMode: true,
      businessName: "ChainDesk",
      industry: "Blockchain",
      audience: "CTOs",
    });
    expect(r.businessName).toBe("ChainDesk");
    expect(r.primaryKeyword.length).toBeGreaterThan(5);
    expect(r.secondaryKeywords.length).toBeGreaterThan(0);
    expect(["transactional", "informational", "local"]).toContain(r.intentType);
  });

  it("detects local intent when a city is present", () => {
    const r = extractSeoIntent({
      userPrompt: "Atlanta tax consultant for small business owners",
      siteType: "auto",
      styleIntensity: 50,
      web3VisualMode: false,
    });
    expect(r.location?.toLowerCase()).toContain("atlanta");
    expect(r.intentType).toBe("local");
  });
});

describe("generateSeoMetadata", () => {
  it("keeps title within 60 chars and includes primary keyword", () => {
    const intent = extractSeoIntent({
      userPrompt: "real estate tokenization platform for accredited investors",
      siteType: "auto",
      styleIntensity: 55,
      web3VisualMode: false,
      businessName: "ParcelMint",
    });
    const m = generateSeoMetadata(intent);
    expect(m.title.length).toBeLessThanOrEqual(60);
    expect(m.title.toLowerCase()).toContain(intent.primaryKeyword.toLowerCase().split(/\s+/)[0]!);
    expect(m.description.length).toBeGreaterThanOrEqual(100);
    expect(m.description.length).toBeLessThanOrEqual(165);
    expect(m.openGraph.type).toBe("website");
    expect(m.twitterCard.card).toBe("summary_large_image");
  });
});

describe("structured data", () => {
  it("includes Organization and Service and LocalBusiness when location set", () => {
    const intent = extractSeoIntent({
      userPrompt: "Miami dental practice — teeth whitening and implants",
      siteType: "local_business",
      styleIntensity: 40,
      web3VisualMode: false,
    });
    const meta = generateSeoMetadata(intent);
    const blocks: { type: string; content?: { aiRegistryKey?: string; body?: string } }[] = [];
    const graphs = buildStructuredDataJsonLd(intent, meta, blocks as any);
    const types = graphs.map((g) => g["@type"]);
    expect(types).toContain("Organization");
    expect(types).toContain("Service");
    expect(types).toContain("LocalBusiness");
  });

  it("adds FAQPage when FAQ body has Q/A pairs", () => {
    const intent = extractSeoIntent({ userPrompt: "FAQ site", siteType: "landing", styleIntensity: 50, web3VisualMode: false });
    const meta = generateSeoMetadata(intent);
    const blocks = [
      {
        type: "section",
        content: {
          aiRegistryKey: "faq",
          body: "Q: Hours?\nA: Mon–Fri 9–5.\n\nQ: Pricing?\nA: Contact us.",
        },
      },
    ] as any;
    const graphs = buildStructuredDataJsonLd(intent, meta, blocks);
    expect(graphs.some((g) => g["@type"] === "FAQPage")).toBe(true);
  });
});

describe("validateSeoQuality", () => {
  it("warns on multiple H1", () => {
    const w = validateSeoQuality({
      title: "Good length title for testing here",
      description: "A".repeat(145),
      primaryKeyword: "testing",
      structuredDataCount: 2,
      h1Count: 2,
    });
    expect(w.warnings.some((x) => /H1/i.test(x))).toBe(true);
  });
});

describe("applySeoIntelligenceToDocument + generator", () => {
  it("injects metadata and structured data on generated schema", async () => {
    const { output } = await runSitePlanner(
      {
        userPrompt: "Build a site for a tax consultant in Seattle — filing and advisory",
        siteType: "trust_operator",
        styleIntensity: 50,
        web3VisualMode: false,
      },
      { invokeLlm: null },
    );
    const schema = generateSiteSchemaFromPlanner(output, "seo-t1", {
      plannerInput: {
        userPrompt: "Build a site for a tax consultant in Seattle — filing and advisory",
        siteType: "trust_operator",
        styleIntensity: 50,
        web3VisualMode: false,
      },
    });
    expect(schema.metadata?.keywords?.length).toBeGreaterThan(0);
    expect(schema.metadata?.structuredData?.length).toBeGreaterThan(1);
    expect(schema.metadata?.openGraph?.title).toBeTruthy();
    expect(schema.metadata?.seoAssistantSummary).toMatch(/optimized/i);
    const hero = schema.pages[0]!.blocks.find((b) => b.type === "hero");
    expect(String((hero?.content as { title?: string })?.title || "").toLowerCase()).toContain(
      String(schema.metadata?.seoPrimaryKeyword || "").toLowerCase().split(/\s+/)[0]!,
    );
  });
});

describe("static export HTML contains SEO tags", () => {
  it("emits ld+json and canonical when metadata is set", () => {
    const doc = SiteSchemaDocument.parse({
      pages: [{ slug: "/", blocks: [{ type: "hero", content: { title: "T", subtitle: "S" } }] }],
      metadata: {
        title: "Test title for export",
        description: "D".repeat(140),
        governance: {},
        canonicalUrl: "https://example.com/",
        robots: "index, follow",
        keywords: ["one", "two"],
        openGraph: {
          title: "Test title for export",
          description: "OG desc",
          image: "https://example.com/og.png",
          type: "website",
        },
        structuredData: [{ "@context": "https://schema.org", "@type": "Thing", name: "X" }],
      },
    });
    const html = generateStaticBundle(doc).files.find((f) => f.path === "index.html")!.content;
    expect(html).toContain("application/ld+json");
    expect(html).toContain("canonical");
    expect(html).toContain("og:title");
  });
});

describe("execute apply_seo_enrichment", () => {
  it("updates SEO fields from focus prompt", async () => {
    const base = SiteSchemaDocument.parse({
      pages: [{ slug: "/", blocks: [{ type: "hero", content: { title: "Old", subtitle: "S" } }] }],
      metadata: {
        title: "Old title",
        description: "Old desc",
        governance: {},
        seoPrimaryKeyword: "old",
      },
    });
    const { schema } = await executeBuilderActions({
      schemaJson: base,
      actions: [{ action: "apply_seo_enrichment", focusPrompt: "optimize for blockchain consulting in Austin" }],
    });
    expect(schema.metadata?.structuredData?.length).toBeGreaterThan(0);
    expect(schema.metadata?.title).not.toBe("Old title");
  });
});

describe("mapExecuteIntentMessage SEO", () => {
  it("maps optimize-for phrasing to apply_seo_enrichment", () => {
    const doc = SiteSchemaDocument.parse({
      pages: [{ slug: "/", blocks: [{ type: "hero", content: { title: "H", subtitle: "s", aiSectionId: "h1" } }] }],
      metadata: { title: "T", governance: {} },
    });
    const out = mapExecuteIntentMessage({
      message: "optimize for Atlanta tax services",
      schema: doc,
      editContext: { lastPageSlug: "/", lastSectionIds: [] },
    });
    expect(out.actions.some((a) => a.action === "apply_seo_enrichment")).toBe(true);
  });
});
