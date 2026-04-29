/**
 * Programmatic Site Builder QA: mirrors the “no site → generate → draft NL edits → export” checklist.
 * Does not start Next.js or hit authenticated HTTP routes; it exercises the same planner, draft-apply
 * stack (`mapExecuteIntentMessage` + `executeBuilderActions` with `siteId: null`) and static export.
 */
import { applyCinematicPostProcessToPlannerOutput } from "@/lib/site-builder/ai/cinematic-planner-layer";
import { generateSiteSchemaFromPlanner } from "@/lib/site-builder/ai/generator";
import { runSitePlanner } from "@/lib/site-builder/ai/planner";
import { SitePlannerInputSchema } from "@/lib/site-builder/ai/schemas";
import { mapExecuteIntentMessage } from "@/lib/site-builder/assistant/map-execute-intent-message";
import { executeBuilderActions } from "@/lib/site-builder/builder-actions/execute-builder-actions";
import { finalizeGenerationWithTroothertzAndBrandBrain } from "@/lib/site-builder/brand-brain-pipeline";
import {
  filterDraftSafeBuilderActions,
  isSiteBuilderDraftMode,
  tryAttachToThemeOnlyDraft,
} from "@/lib/site-builder/draft/site-builder-draft";
import { buildDeploymentProjectFromSchema } from "@/lib/site-builder/project-export/orchestrate";
import { SiteSchemaDocument, type SiteSchemaDocumentType } from "@/lib/site-builder/schema";

const QA_PROMPT =
  "Build a bold white-background Web3 consulting landing page with cinematic sections and a blue AI agent bubble.";

async function applyDraftNl(doc: SiteSchemaDocumentType, message: string): Promise<SiteSchemaDocumentType> {
  const mapped = mapExecuteIntentMessage({
    message,
    schema: doc,
    editContext: { lastSectionIds: [], lastPageSlug: "/" },
  });
  const { safe } = filterDraftSafeBuilderActions(tryAttachToThemeOnlyDraft(mapped.actions));
  if (safe.length === 0) {
    throw new Error(`draft NL produced no safe actions for: ${message}`);
  }
  const out = await executeBuilderActions({
    schemaJson: doc,
    actions: safe,
    siteId: null,
  });
  return SiteSchemaDocument.parse(out.schema);
}

describe("Site Builder QA (programmatic draft → export)", () => {
  it("full checklist: generate preview, draft edits, export preserves style + sections + SEO + widget stub", async () => {
    const input = SitePlannerInputSchema.parse({
      userPrompt: QA_PROMPT,
      siteType: "trust_operator",
      designDirection: "bold",
      styleIntensity: 72,
      web3VisualMode: true,
      widgetKey: "agencywidget12",
      widgetPlacement: "body_end",
    });

    const planned = await runSitePlanner(input, { invokeLlm: null });
    const cinematicPlanner = applyCinematicPostProcessToPlannerOutput(input, planned.output, {
      variantIndex: 0,
      variantCount: 1,
    });

    let doc = generateSiteSchemaFromPlanner(cinematicPlanner, "qa-live-seed", { plannerInput: input });
    doc.metadata = doc.metadata ?? { title: "Site", governance: {} };
    doc.metadata.widgetIntegration = {
      ...(doc.metadata.widgetIntegration ?? {}),
      widgetKey: input.widgetKey!.trim(),
      placement: input.widgetPlacement ?? "body_end",
    };
    doc.metadata.theme = {
      ...(doc.metadata.theme ?? {}),
      gradientStart: "#2563eb",
      gradientEnd: "#1e3a8a",
    };

    finalizeGenerationWithTroothertzAndBrandBrain(doc);
    doc = SiteSchemaDocument.parse(doc);

    const schemaText = JSON.stringify(doc, null, 2);
    expect(isSiteBuilderDraftMode(schemaText, null)).toBe(true);
    expect(doc.pages[0]?.blocks?.length ?? 0).toBeGreaterThanOrEqual(3);

    doc = await applyDraftNl(doc, "Make the background white");
    expect(doc.metadata?.theme?.backgroundMode).toBe("custom_color");
    expect(String(doc.metadata?.theme?.backgroundColor || "").toLowerCase()).toBe("#ffffff");

    doc = await applyDraftNl(doc, "Add pricing");
    doc = await applyDraftNl(doc, "Add FAQ");

    const titles = (doc.pages[0]?.blocks ?? []).map((b) => String((b.content as { title?: string })?.title ?? ""));
    expect(titles.some((t) => /pricing/i.test(t))).toBe(true);
    expect(titles.some((t) => /faq/i.test(t))).toBe(true);

    expect(doc.metadata?.title?.trim().length).toBeGreaterThan(0);
    expect(doc.metadata?.description?.trim().length).toBeGreaterThan(0);

    const files = await buildDeploymentProjectFromSchema(doc, { userId: null });
    const index = files.find((f) => f.path === "index.html")?.content ?? "";
    const css = files.find((f) => f.path === "styles.css")?.content ?? "";

    expect(index).toMatch(/<title>/i);
    expect(index).toMatch(/meta\s+name=["']description["']/i);
    expect(index).toMatch(/Pricing/i);
    expect(index).toMatch(/FAQ/i);
    expect(index).toContain("TROO_AGENT_CONFIG");
    expect(index + css).toMatch(/--ds-color-accent/i);

    expect(css.length).toBeGreaterThan(500);
    expect(css + index).toMatch(/#fff(?:fff)?|ffffff/i);
  });
});
