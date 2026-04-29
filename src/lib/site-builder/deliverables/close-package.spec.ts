/** @jest-environment node */
import { SiteSchemaDocument } from "@/lib/site-builder/schema";
import {
  assembleDeliverablesFromSchema,
  deliverablesToBundledFiles,
} from "@/lib/site-builder/assemble-deliverables";
import { buildClosePackageModel } from "@/lib/site-builder/deliverables/close-package-model";
import {
  renderApprovalSummaryMarkdown,
  renderKickoffPacketMarkdown,
  renderOnboardingChecklistMarkdown,
} from "@/lib/site-builder/deliverables/close-package-artifacts";
import { finalizeImportedSiteDocument, importBlueprintToSiteSchema } from "@/lib/site-builder/site-import/blueprint-to-schema";
import { htmlToImportBlueprint } from "@/lib/site-builder/site-import/html-to-blueprint";

function minimalGovernance() {
  return { brandPassVersion: 1 };
}

describe("close / onboarding package", () => {
  const fixtureHtml = `<!DOCTYPE html><html><head><title>T</title></head><body>
    <h1>Welcome offer</h1><p>We help you grow.</p><h2>Services</h2><p>Strategy.</p>
    <footer><a href="/contact">Contact</a></footer></body></html>`;

  it("bundled deliverables include close artifacts after proposal block", () => {
    const bp = htmlToImportBlueprint(fixtureHtml, "https://example.com/");
    let doc = importBlueprintToSiteSchema(bp);
    doc = finalizeImportedSiteDocument(doc);
    doc.metadata = {
      ...doc.metadata,
      consultantProposalPosture: { selectedTier: "partner", scopePosture: "expanded" },
    };
    const d = assembleDeliverablesFromSchema(doc);
    const paths = deliverablesToBundledFiles(d, doc).map((x) => x.path);
    const ixProposal = paths.indexOf("proposal-close-email.md");
    const ixApproval = paths.indexOf("approval-summary.md");
    expect(paths).toContain("approval-summary.md");
    expect(paths).toContain("onboarding-checklist.md");
    expect(paths).toContain("kickoff-packet.md");
    expect(ixApproval).toBeGreaterThan(ixProposal);
  });

  it("approval summary has structural headings and no internal keys", () => {
    const bp = htmlToImportBlueprint(fixtureHtml, "https://example.com/");
    let doc = importBlueprintToSiteSchema(bp);
    doc = finalizeImportedSiteDocument(doc);
    const d = assembleDeliverablesFromSchema(doc);
    const md = renderApprovalSummaryMarkdown(d, doc);
    expect(md).toMatch(/# Approval summary/);
    expect(md).toMatch(/## Selected posture/);
    expect(md).toMatch(/## Overview/);
    expect(md).toMatch(/## Included outcomes/);
    expect(md).not.toMatch(/aiRegistryKey/);
    expect(md).not.toMatch(/builderRefinement/);
  });

  it("onboarding checklist uses checkbox lines", () => {
    const bp = htmlToImportBlueprint(fixtureHtml, "https://example.com/");
    let doc = importBlueprintToSiteSchema(bp);
    doc = finalizeImportedSiteDocument(doc);
    const d = assembleDeliverablesFromSchema(doc);
    const md = renderOnboardingChecklistMarkdown(d, doc);
    expect(md).toMatch(/# Onboarding checklist/);
    expect(md).toMatch(/^- \[ \] /m);
  });

  it("kickoff packet sections present", () => {
    const bp = htmlToImportBlueprint(fixtureHtml, "https://example.com/");
    let doc = importBlueprintToSiteSchema(bp);
    doc = finalizeImportedSiteDocument(doc);
    const d = assembleDeliverablesFromSchema(doc);
    const md = renderKickoffPacketMarkdown(d, doc);
    expect(md).toMatch(/# Kickoff packet/);
    expect(md).toMatch(/## What the consultant does first/);
  });

  it("proposal posture in metadata changes close model tier labels", () => {
    const doc = SiteSchemaDocument.parse({
      pages: [{ slug: "/", blocks: [{ type: "hero", content: { title: "A", subtitle: "B" } }] }],
      metadata: {
        title: "T",
        governance: minimalGovernance(),
        consultantProposalPosture: { selectedTier: "essential", scopePosture: "starter" },
      },
    });
    const d = assembleDeliverablesFromSchema(doc);
    const m = buildClosePackageModel(d, doc);
    expect(m.proposalSelection.selectedTier).toBe("essential");
    expect(m.proposalSelection.scopePosture).toBe("starter");
  });
});
