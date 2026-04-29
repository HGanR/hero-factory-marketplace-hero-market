/** @jest-environment node */
import { SiteSchemaDocument } from "@/lib/site-builder/schema";
import { assembleDeliverablesFromSchema, deliverablesToBundledFiles } from "@/lib/site-builder/assemble-deliverables";
import { DeliverablesDocumentSchema } from "@/lib/site-builder/deliverables-schema";
import {
  buildClientHandoffContext,
  renderClientHandoffHtml,
  renderClientHandoffMarkdown,
} from "@/lib/site-builder/deliverables/client-handoff-render";
import { finalizeImportedSiteDocument, importBlueprintToSiteSchema } from "@/lib/site-builder/site-import/blueprint-to-schema";
import { htmlToImportBlueprint } from "@/lib/site-builder/site-import/html-to-blueprint";

function minimalGovernance() {
  return { brandPassVersion: 1 };
}

describe("client handoff rendering", () => {
  const fixtureHtml = `<!DOCTYPE html><html><head><title>T</title></head><body>
    <h1>Welcome offer</h1><p>We help you grow.</p><h2>Services</h2><p>Strategy.</p>
    <footer><a href="/contact">Contact</a></footer></body></html>`;

  it("renders Markdown with expected sections and branding", () => {
    const bp = htmlToImportBlueprint(fixtureHtml, "https://example.com/");
    let doc = importBlueprintToSiteSchema(bp);
    doc = finalizeImportedSiteDocument(doc);
    const d = assembleDeliverablesFromSchema(doc);
    const ctx = buildClientHandoffContext(doc);
    const md = renderClientHandoffMarkdown(d, ctx);
    expect(md).toMatch(/^#\s.+/m);
    expect(md).toMatch(/## Executive summary/i);
    expect(md).toMatch(/## Strategic improvements/i);
    expect(md).toMatch(/## Route evolution/i);
    expect(md).toMatch(/## Stakeholder questions/i);
    expect(md).toMatch(/## Launch checklist/i);
    expect(md).toMatch(/TROOTHHERTZ/);
  });

  it("Markdown and HTML use the same consultant framing for key sections (no MD/HTML drift)", () => {
    const bp = htmlToImportBlueprint(fixtureHtml, "https://example.com/");
    let doc = importBlueprintToSiteSchema(bp);
    doc = finalizeImportedSiteDocument(doc);
    const d = assembleDeliverablesFromSchema(doc);
    const ctx = buildClientHandoffContext(doc);
    const md = renderClientHandoffMarkdown(d, ctx);
    const html = renderClientHandoffHtml(d, ctx);
    const shared = [
      "trust, clarity, and stronger conversion paths",
      "Each route is framed as a strategic improvement",
      "not a technical runbook",
    ];
    for (const phrase of shared) {
      expect(md).toContain(phrase);
      expect(html).toContain(phrase);
    }
    expect(d.summary.topImprovements.length).toBe((html.match(/<section aria-labelledby="imp-h"[\s\S]*?<\/section>/)?.[0].match(/<li>/g) ?? []).length);
  });

  it("renders PDF-ready HTML with semantic structure and no raw angle brackets from prose", () => {
    const bp = htmlToImportBlueprint(fixtureHtml, "https://example.com/");
    let doc = importBlueprintToSiteSchema(bp);
    doc = finalizeImportedSiteDocument(doc);
    const d = assembleDeliverablesFromSchema(doc);
    const ctx = buildClientHandoffContext(doc);
    const html = renderClientHandoffHtml(d, ctx);
    expect(html).toMatch(/<!DOCTYPE html>/i);
    expect(html).toMatch(/<section[^>]*aria-labelledby/i);
    expect(html).toMatch(/@media print/);
    expect(html).toMatch(/<title>/);
    expect(html).not.toMatch(/aiRegistryKey/);
    expect(html).not.toMatch(/opportunityCode/);
    expect(html).not.toMatch(/import_route_stub/);
  });

  it("bundled deliverables include handoff files first and preserve JSON artifacts", () => {
    const bp = htmlToImportBlueprint(fixtureHtml, "https://example.com/");
    let doc = importBlueprintToSiteSchema(bp);
    doc = finalizeImportedSiteDocument(doc);
    const d = assembleDeliverablesFromSchema(doc);
    const files = deliverablesToBundledFiles(d, doc);
    const paths = files.map((x) => x.path);
    expect(paths[0]).toBe("client-handoff.md");
    expect(paths[1]).toBe("client-handoff.html");
    expect(paths).toEqual(
      expect.arrayContaining(["summary.md", "route-outline.json", "faq.json", "checklist.json"]),
    );
  });

  it("handoff context falls back safely without imported audit", () => {
    const doc = SiteSchemaDocument.parse({
      pages: [{ slug: "/", blocks: [{ type: "hero", content: { title: "Only", subtitle: "One" } }] }],
      metadata: { title: "Green", governance: minimalGovernance() },
    });
    const d = assembleDeliverablesFromSchema(doc);
    expect(() => DeliverablesDocumentSchema.parse(d)).not.toThrow();
    const ctx = buildClientHandoffContext(doc);
    expect(ctx.siteTitle).toBe("Green");
    const md = renderClientHandoffMarkdown(d, ctx);
    expect(md.length).toBeGreaterThan(50);
    expect(md).not.toMatch(/importedSiteAudit/);
  });

  it("does not echo internal jargon in Markdown output for typical deliverables", () => {
    const bp = htmlToImportBlueprint(fixtureHtml, "https://example.com/");
    let doc = importBlueprintToSiteSchema(bp);
    doc = finalizeImportedSiteDocument(doc);
    const d = assembleDeliverablesFromSchema(doc);
    const md = renderClientHandoffMarkdown(d, buildClientHandoffContext(doc));
    expect(md).not.toMatch(/\baiSectionId\b/i);
    expect(md).not.toMatch(/builderRefinement/);
  });
});
