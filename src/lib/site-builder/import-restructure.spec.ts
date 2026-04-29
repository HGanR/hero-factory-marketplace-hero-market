/** @jest-environment node */
import { SiteSchemaDocument } from "@/lib/site-builder/schema";
import { evaluateImportedSiteRestructure } from "@/lib/site-builder/import-restructure-evaluator";
import { syncImportRestructureIntoDocument } from "@/lib/site-builder/import-restructure-sync";
import {
  applyImportRestructureOpportunity,
  pickImportRestructureSuggestionsForUi,
} from "@/lib/site-builder/import-restructure-apply";
import { generateStaticBundle } from "@/lib/site-builder/static-generator";
import { htmlToImportBlueprint } from "@/lib/site-builder/site-import/html-to-blueprint";
import { importBlueprintToSiteSchema, finalizeImportedSiteDocument } from "@/lib/site-builder/site-import/blueprint-to-schema";

function minimalGovernance() {
  return { brandPassVersion: 1 };
}

describe("import restructuring advisory", () => {
  const fixtureHtml = `<!DOCTYPE html><html><head><title>T</title></head><body>
    <h1>Short</h1><p>x</p><h2>Services we offer</h2><p>Strategy work.</p>
    <footer><a href="/">Home</a></footer></body></html>`;

  it("finalizeImportedSiteDocument persists audit + queue on schema", () => {
    const bp = htmlToImportBlueprint(fixtureHtml, "https://example.com/");
    let doc = importBlueprintToSiteSchema(bp, { widgetKey: "testwidgetkey12345678" });
    doc = finalizeImportedSiteDocument(doc);
    const parsed = SiteSchemaDocument.safeParse(doc);
    expect(parsed.success).toBe(true);
    expect(parsed.data.metadata?.importedSiteAudit?.opportunities?.length).toBeGreaterThan(0);
    expect(parsed.data.metadata?.importRestructureQueue?.length).toBeGreaterThan(0);
    expect(parsed.data.metadata?.widgetIntegration?.widgetKey).toBe("testwidgetkey12345678");
  });

  it("evaluateImportedSiteRestructure is deterministic for same document shape", () => {
    const bp = htmlToImportBlueprint(fixtureHtml, "https://example.com/");
    let doc = importBlueprintToSiteSchema(bp);
    doc = finalizeImportedSiteDocument(doc);
    const a1 = evaluateImportedSiteRestructure(doc);
    const a2 = evaluateImportedSiteRestructure(doc);
    expect(a1.evaluatedAt).toBe(a2.evaluatedAt);
    expect(a1.summary).toBe(a2.summary);
  });

  it("syncImportRestructureIntoDocument is no-op for greenfield (no siteImport)", () => {
    const doc = SiteSchemaDocument.parse({
      pages: [{ slug: "/", blocks: [{ type: "hero", content: { title: "Hi", subtitle: "There" } }] }],
      metadata: { title: "T", governance: minimalGovernance() },
    });
    const { changed } = syncImportRestructureIntoDocument(doc);
    expect(changed).toBe(false);
  });

  it("apply preserves widget metadata and export still produces index.html", () => {
    const bp = htmlToImportBlueprint(fixtureHtml, "https://client.example.com/");
    let doc = importBlueprintToSiteSchema(bp, {
      widgetKey: "testwidgetkey12345678",
      loaderOrigin: "https://app.example.com",
    });
    doc = finalizeImportedSiteDocument(doc);
    const item = pickImportRestructureSuggestionsForUi(doc, 1)[0];
    expect(item).toBeTruthy();
    const { doc: next, applied } = applyImportRestructureOpportunity(doc, item!.opportunityCode);
    expect(applied).toBe(true);
    expect(next.metadata?.widgetIntegration?.widgetKey).toBe("testwidgetkey12345678");
    expect(next.metadata?.siteImport?.sourceUrl).toContain("client.example.com");
    process.env.NEXT_PUBLIC_SITE_URL = "https://app.example.com";
    const { files } = generateStaticBundle(next);
    const index = files.find((f) => f.path === "index.html")?.content ?? "";
    expect(index.length).toBeGreaterThan(100);
  });
});
