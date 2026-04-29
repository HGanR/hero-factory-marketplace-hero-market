/** @jest-environment node */
import { SiteSchemaDocument } from "@/lib/site-builder/schema";
import {
  assembleDeliverablesFromSchema,
  deliverablesToBundledFiles,
} from "@/lib/site-builder/assemble-deliverables";
import {
  renderProposalCloseEmailMarkdown,
  renderProposalPricingMarkdown,
  renderProposalScopeMarkdown,
} from "@/lib/site-builder/deliverables/proposal-artifacts";
import { finalizeImportedSiteDocument, importBlueprintToSiteSchema } from "@/lib/site-builder/site-import/blueprint-to-schema";
import { htmlToImportBlueprint } from "@/lib/site-builder/site-import/html-to-blueprint";

function minimalGovernance() {
  return { brandPassVersion: 1 };
}

describe("proposal artifacts", () => {
  const fixtureHtml = `<!DOCTYPE html><html><head><title>T</title></head><body>
    <h1>Welcome offer</h1><p>We help you grow.</p><h2>Services</h2><p>Strategy.</p>
    <footer><a href="/contact">Contact</a></footer></body></html>`;

  it("bundled deliverables include proposal files in stable order (before social)", () => {
    const bp = htmlToImportBlueprint(fixtureHtml, "https://example.com/");
    let doc = importBlueprintToSiteSchema(bp);
    doc = finalizeImportedSiteDocument(doc);
    const d = assembleDeliverablesFromSchema(doc);
    const paths = deliverablesToBundledFiles(d, doc).map((x) => x.path);
    const ixSocial = paths.indexOf("social.txt");
    const ixScope = paths.indexOf("proposal-scope.md");
    expect(ixScope).toBeGreaterThan(-1);
    expect(paths).toContain("proposal-pricing.md");
    expect(paths).toContain("proposal-close-email.md");
    if (ixSocial >= 0) {
      expect(ixScope).toBeLessThan(ixSocial);
    }
  });

  it("scope document has expected top-level sections and no internal jargon", () => {
    const bp = htmlToImportBlueprint(fixtureHtml, "https://example.com/");
    let doc = importBlueprintToSiteSchema(bp);
    doc = finalizeImportedSiteDocument(doc);
    const d = assembleDeliverablesFromSchema(doc);
    const md = renderProposalScopeMarkdown(d, doc);
    expect(md).toMatch(/# Objectives/);
    expect(md).toMatch(/# Scope of Work/);
    expect(md).toMatch(/# Inclusions/);
    expect(md).toMatch(/# Out of Scope/);
    expect(md).toMatch(/# Assumptions/);
    expect(md).toMatch(/# Client Responsibilities/);
    expect(md).toMatch(/# Acceptance Criteria/);
    expect(md).not.toMatch(/aiRegistryKey/);
    expect(md).not.toMatch(/opportunityCode/);
    expect(md).not.toMatch(/builderRefinement/);
  });

  it("pricing document has tier table, value framing, and no numeric digits", () => {
    const bp = htmlToImportBlueprint(fixtureHtml, "https://example.com/");
    let doc = importBlueprintToSiteSchema(bp);
    doc = finalizeImportedSiteDocument(doc);
    const d = assembleDeliverablesFromSchema(doc);
    const md = renderProposalPricingMarkdown(d, doc);
    expect(md).toMatch(/\| Tier \|/);
    expect(md).toMatch(/Essential/);
    expect(md).toMatch(/Standard/);
    expect(md).toMatch(/Partner/);
    expect(md).toMatch(/\[Pricing TBD\]/);
    expect(/\d/.test(md)).toBe(false);
    expect(md).not.toMatch(/\$/);
  });

  it("close email contains placeholders and consultant tone", () => {
    const bp = htmlToImportBlueprint(fixtureHtml, "https://example.com/");
    let doc = importBlueprintToSiteSchema(bp);
    doc = finalizeImportedSiteDocument(doc);
    const d = assembleDeliverablesFromSchema(doc);
    const md = renderProposalCloseEmailMarkdown(d, doc);
    expect(md).toMatch(/\{client_name\}/);
    expect(md).toMatch(/\{project_name\}/);
    expect(md).toMatch(/\{approval_link\}/);
    expect(md).toMatch(/\{kickoff_link\}/);
    expect(md).toMatch(/\{invoice_link\}/);
    expect(md).toMatch(/\[Your name\]/);
  });

  it("outputs are deterministic for the same document (no timestamps in proposal bodies)", () => {
    const doc = SiteSchemaDocument.parse({
      pages: [{ slug: "/", blocks: [{ type: "hero", content: { title: "Only", subtitle: "One" } }] }],
      metadata: { title: "GF", governance: minimalGovernance() },
    });
    const d = assembleDeliverablesFromSchema(doc);
    const a = renderProposalScopeMarkdown(d, doc);
    const b = renderProposalScopeMarkdown(d, doc);
    expect(a).toBe(b);
  });
});
