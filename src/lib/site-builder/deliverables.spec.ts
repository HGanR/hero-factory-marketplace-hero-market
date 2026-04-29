/** @jest-environment node */
import { SiteSchemaDocument } from "@/lib/site-builder/schema";
import {
  assembleDeliverablesFromSchema,
  buildImprovementSummary,
  buildLaunchChecklist,
  buildRouteOutline,
  buildSocialSnippets,
  buildStakeholderFaq,
  deliverablesToBundledFiles,
  renderDeliverablesSummaryMarkdown,
  shouldIncludeDeliverablesInExport,
} from "@/lib/site-builder/assemble-deliverables";
import { DeliverablesDocumentSchema } from "@/lib/site-builder/deliverables-schema";
import { finalizeImportedSiteDocument, importBlueprintToSiteSchema } from "@/lib/site-builder/site-import/blueprint-to-schema";
import { htmlToImportBlueprint } from "@/lib/site-builder/site-import/html-to-blueprint";
import { buildDeploymentProjectFromSchema } from "@/lib/site-builder/project-export/orchestrate";
import { projectExportPaths } from "@/lib/site-builder/project-export/export-test-helpers";

function minimalGovernance() {
  return { brandPassVersion: 1 };
}

describe("deliverables (imported + greenfield)", () => {
  const fixtureHtml = `<!DOCTYPE html><html><head><title>T</title></head><body>
    <h1>Welcome offer</h1><p>We help you grow.</p><h2>Services</h2><p>Strategy.</p>
    <footer><a href="/contact">Contact</a></footer></body></html>`;

  it("shouldIncludeDeliverablesInExport requires import audit", () => {
    const green = SiteSchemaDocument.parse({
      pages: [{ slug: "/", blocks: [{ type: "hero", content: { title: "Hi", subtitle: "There" } }] }],
      metadata: { title: "G", governance: minimalGovernance() },
    });
    expect(shouldIncludeDeliverablesInExport(green)).toBe(false);
    const bp = htmlToImportBlueprint(fixtureHtml, "https://example.com/");
    let doc = importBlueprintToSiteSchema(bp);
    doc = finalizeImportedSiteDocument(doc);
    expect(shouldIncludeDeliverablesInExport(doc)).toBe(true);
  });

  it("assembles a document that validates and includes summary, route outline, FAQ, grouped checklist", () => {
    const bp = htmlToImportBlueprint(fixtureHtml, "https://example.com/");
    let doc = importBlueprintToSiteSchema(bp);
    doc = finalizeImportedSiteDocument(doc);
    doc.metadata = {
      ...doc.metadata,
      builderRefinement: { deploymentTarget: "static", routingMode: "single_page", assetStrategy: "local_bundle" },
    };
    const d = assembleDeliverablesFromSchema(doc);
    expect(() => DeliverablesDocumentSchema.parse(d)).not.toThrow();
    expect(d.summary.executiveSummary.length).toBeGreaterThan(20);
    expect(d.summary.topImprovements.length).toBeGreaterThanOrEqual(1);
    expect(d.routeOutline.length).toBeGreaterThanOrEqual(1);
    expect(d.stakeholderFaq.length).toBeGreaterThanOrEqual(4);
    expect(d.launchChecklist.every((s) => s.label && s.items.length > 0)).toBe(true);
    const md = renderDeliverablesSummaryMarkdown(d.summary);
    expect(md).toMatch(/Executive summary/i);
    expect(md).not.toMatch(/<html/i);
    expect(md).not.toMatch(/aiSectionId/i);
  });

  it("sub-builders return structured shapes", () => {
    const bp = htmlToImportBlueprint(fixtureHtml, "https://acme.test/");
    let doc = importBlueprintToSiteSchema(bp);
    doc = finalizeImportedSiteDocument(doc);
    expect(buildImprovementSummary(doc).topImprovements.length).toBeGreaterThanOrEqual(1);
    expect(buildRouteOutline(doc)[0]?.route).toMatch(/^\//);
    expect(buildStakeholderFaq(doc)[0]?.question.length).toBeGreaterThan(5);
    expect(buildLaunchChecklist(doc).map((x) => x.label).join(" ")).toMatch(/Deployment/);
  });

  it("social snippets are capped at three and come from blocks", () => {
    const bp = htmlToImportBlueprint(fixtureHtml, "https://example.com/");
    let doc = importBlueprintToSiteSchema(bp);
    doc = finalizeImportedSiteDocument(doc);
    const s = buildSocialSnippets(doc);
    expect(s.length).toBeLessThanOrEqual(3);
    const full = assembleDeliverablesFromSchema(doc);
    expect(full.socialSnippets?.length ?? 0).toBeLessThanOrEqual(3);
  });

  it("bundled file list matches export layout", () => {
    const bp = htmlToImportBlueprint(fixtureHtml, "https://example.com/");
    let doc = importBlueprintToSiteSchema(bp);
    doc = finalizeImportedSiteDocument(doc);
    const d = assembleDeliverablesFromSchema(doc);
    const files = deliverablesToBundledFiles(d, doc).map((x) => x.path);
    expect(files[0]).toBe("client-handoff.md");
    expect(files[1]).toBe("client-handoff.html");
    expect(files).toContain("summary.md");
    expect(files).toContain("route-outline.json");
    expect(files).toContain("faq.json");
    expect(files).toContain("checklist.json");
    expect(files).toContain("proposal-scope.md");
    expect(files).toContain("proposal-pricing.md");
    expect(files).toContain("proposal-close-email.md");
    expect(files).toContain("approval-summary.md");
    expect(files).toContain("onboarding-checklist.md");
    expect(files).toContain("kickoff-packet.md");
  });

  it("export ZIP includes deliverables/ files when audit present", async () => {
    const bp = htmlToImportBlueprint(fixtureHtml, "https://example.com/");
    let doc = importBlueprintToSiteSchema(bp);
    doc = finalizeImportedSiteDocument(doc);
    const files = await buildDeploymentProjectFromSchema(doc);
    const paths = projectExportPaths(files);
    expect(paths).toEqual(
      expect.arrayContaining([
        "deliverables/client-handoff.md",
        "deliverables/client-handoff.html",
        "deliverables/summary.md",
        "deliverables/route-outline.json",
        "deliverables/faq.json",
        "deliverables/checklist.json",
        "deliverables/proposal-scope.md",
        "deliverables/proposal-pricing.md",
        "deliverables/proposal-close-email.md",
        "deliverables/approval-summary.md",
        "deliverables/onboarding-checklist.md",
        "deliverables/kickoff-packet.md",
      ]),
    );
  });

  it("greenfield export omits deliverables folder", async () => {
    const doc = SiteSchemaDocument.parse({
      pages: [{ slug: "/", blocks: [{ type: "hero", content: { title: "Hello", subtitle: "World" } }] }],
      metadata: { title: "X", governance: minimalGovernance() },
    });
    const files = await buildDeploymentProjectFromSchema(doc);
    expect(projectExportPaths(files).some((p) => p.startsWith("deliverables/"))).toBe(false);
  });

  it("greenfield assembly still returns a valid document", () => {
    const doc = SiteSchemaDocument.parse({
      pages: [{ slug: "/", blocks: [{ type: "hero", content: { title: "Only", subtitle: "One" } }] }],
      metadata: { title: "GF", governance: minimalGovernance() },
    });
    const d = assembleDeliverablesFromSchema(doc);
    expect(DeliverablesDocumentSchema.safeParse(d).success).toBe(true);
  });
});
