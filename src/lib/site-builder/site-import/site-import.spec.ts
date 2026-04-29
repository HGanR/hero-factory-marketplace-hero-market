/** @jest-environment node */
import { generateStaticBundle } from "@/lib/site-builder/static-generator";
import { SiteSchemaDocument } from "@/lib/site-builder/schema";
import { buildAgencyWidgetSnippetHtml } from "@/lib/site-builder/site-builder-widget-embed";
import { ImportBlueprintSchema } from "@/lib/site-builder/site-import/import-blueprint";
import { htmlToImportBlueprint } from "@/lib/site-builder/site-import/html-to-blueprint";
import { importBlueprintToSiteSchema, finalizeImportedSiteDocument } from "@/lib/site-builder/site-import/blueprint-to-schema";
import { inferRouteFamilyFromPath } from "@/lib/site-builder/site-import/route-family";

describe("site import pipeline", () => {
  const fixtureHtml = `<!DOCTYPE html><html lang="en"><head>
  <title>Acme Consulting</title>
  <meta name="description" content="We help operators scale." />
  <style>.x{color:#112233}</style></head><body>
  <nav><a href="/about">About</a><a href="/contact">Contact</a></nav>
  <main>
    <h1>Transform your operations</h1>
    <p>We partner with founders who need clarity.</p>
    <h2>Services</h2>
    <p>Strategy and implementation.</p>
    <img src="/team.jpg" alt="Team" />
  </main>
  <footer><a href="/privacy">Privacy</a></footer>
  </body></html>`;

  it("htmlToImportBlueprint extracts structure and queued routes", () => {
    const bp = htmlToImportBlueprint(fixtureHtml, "https://acme.example/");
    expect(bp.title).toContain("Acme");
    expect(bp.sections.some((s) => s.kind === "hero")).toBe(true);
    expect(bp.queuedRoutes?.length).toBeGreaterThan(0);
    expect(bp.nav?.length).toBeGreaterThan(0);
  });

  it("importBlueprintToSiteSchema produces valid SiteSchemaDocument with aiSectionIds", () => {
    const bp = htmlToImportBlueprint(fixtureHtml, "https://acme.example/");
    const doc = importBlueprintToSiteSchema(bp, {
      widgetKey: "testwidgetkey12345678",
      widgetPlacement: "body_end",
      loaderOrigin: "https://app.example.com",
    });
    const parsed = SiteSchemaDocument.safeParse(doc);
    expect(parsed.success).toBe(true);
    expect(parsed.data.pages[0]?.blocks.some((b) => String(b.content?.aiSectionId || "").length > 0)).toBe(true);
    expect(parsed.data.metadata?.widgetIntegration?.widgetKey).toBe("testwidgetkey12345678");
    expect(parsed.data.metadata?.siteImport?.sourceUrl).toContain("acme.example");
    const hero = parsed.data.pages[0]?.blocks.find((b) => b.type === "hero");
    expect(String((hero?.content as { aiRegistryKey?: string })?.aiRegistryKey)).toBe("hero_primary");
    const img = parsed.data.pages[0]?.blocks.find((b) => b.type === "image");
    expect((img as { src?: string })?.src).toContain("acme.example/team.jpg");
    expect(String((img?.content as { aiRegistryKey?: string })?.aiRegistryKey)).toBe("image_spotlight");
  });

  it("importBlueprintToSiteSchema never leaves home page without blocks", () => {
    const bp = ImportBlueprintSchema.parse({
      version: 1,
      sourceUrl: "https://empty.example/",
      sections: [],
      notes: ["Nothing extracted"],
    });
    const doc = importBlueprintToSiteSchema(bp);
    expect(doc.pages[0]?.blocks?.length ?? 0).toBeGreaterThan(0);
    expect(doc.metadata?.siteImport?.emptyStructureFallback).toBe(true);
    expect(SiteSchemaDocument.safeParse(doc).success).toBe(true);
  });

  it("htmlToImportBlueprint resolves relative image URLs", () => {
    const html = `<!DOCTYPE html><html><body><main><h1>Hi</h1><img src="/a/b.png" alt="X" /></main></body></html>`;
    const bp = htmlToImportBlueprint(html, "https://cdn.example/");
    const media = bp.sections.filter((s) => s.kind === "media");
    expect(media.some((m) => m.imageUrls?.[0]?.startsWith("https://cdn.example/a/b.png"))).toBe(true);
  });

  it("htmlToImportBlueprint uses meta fallback when body is empty", () => {
    const html = `<!DOCTYPE html><html><head><title>T</title><meta name="description" content="Hello from meta" /></head><body></body></html>`;
    const bp = htmlToImportBlueprint(html, "https://spa.example/");
    expect(bp.sections.length).toBeGreaterThan(0);
    expect(bp.notes?.some((n) => /meta description/i.test(n))).toBe(true);
  });

  it("finalizeImportedSiteDocument keeps schema parseable", () => {
    const bp = htmlToImportBlueprint(fixtureHtml, "https://acme.example/");
    let doc = importBlueprintToSiteSchema(bp);
    doc = finalizeImportedSiteDocument(doc);
    expect(SiteSchemaDocument.safeParse(doc).success).toBe(true);
  });

  it("static export includes widget snippet when loader origin set", () => {
    const bp = htmlToImportBlueprint(fixtureHtml, "https://acme.example/");
    let doc = importBlueprintToSiteSchema(bp, {
      widgetKey: "testwidgetkey12345678",
      loaderOrigin: "https://app.example.com",
    });
    doc = finalizeImportedSiteDocument(doc);
    process.env.NEXT_PUBLIC_SITE_URL = "https://app.example.com";
    const { files } = generateStaticBundle(doc);
    const index = files.find((f) => f.path === "index.html")?.content ?? "";
    expect(index).toContain("TROO_AGENT_CONFIG");
    expect(index).toContain("/widget/loader.js");
  });

  it("buildAgencyWidgetSnippetHtml respects page_body_end slug filter", () => {
    const doc = SiteSchemaDocument.parse({
      pages: [{ slug: "/", blocks: [] }],
      metadata: {
        title: "T",
        widgetIntegration: {
          widgetKey: "testwidgetkey12345678",
          placement: "page_body_end",
          pageSlug: "/about",
          loaderOrigin: "https://x.com",
        },
      },
    });
    expect(buildAgencyWidgetSnippetHtml(doc, "/").bodyBeforeClose).toBe("");
    expect(buildAgencyWidgetSnippetHtml(doc, "/about").bodyBeforeClose.length).toBeGreaterThan(10);
  });

  it("inferRouteFamilyFromPath maps common segments", () => {
    expect(inferRouteFamilyFromPath("/about")).toBe("about");
    expect(inferRouteFamilyFromPath("/contact-us")).toBe("contact");
  });
});
