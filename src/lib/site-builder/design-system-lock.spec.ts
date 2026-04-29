import { describe, expect, it } from "@jest/globals";
import type { SitePlannerOutput } from "@/lib/site-builder/ai/schemas";
import { SitePlannerOutputSchema } from "@/lib/site-builder/ai/schemas";
import { composeHomeSectionPlan } from "@/lib/site-builder/ai/section-composition";
import { buildDesignSystemFromPlanner } from "@/lib/site-builder/design-system";
import { applyDesignSystemLockToDocument } from "@/lib/site-builder/design-system-lock";
import type { SiteSchemaDocumentType } from "@/lib/site-builder/schema";

function plannerFromHomePlan(
  intent: SitePlannerOutput["intent"],
  layoutFamilyId: string | undefined,
): SitePlannerOutput {
  const rows = composeHomeSectionPlan(intent, "corporate", false, "B2B analytics for operators", 0, layoutFamilyId);
  return SitePlannerOutputSchema.parse({
    version: 1,
    intent,
    normalizedBrief: "B2B analytics for operators",
    sitemap: [{ slug: "/", title: "Home", purpose: "Landing" }],
    sectionPlan: rows.map((r) => ({
      id: r.id,
      registryKey: r.registryKey,
      headline: r.headline,
      purpose: r.purpose,
      rhythmSurface: r.rhythmSurface,
      spacingScale: r.spacingScale,
      sectionRole: r.sectionRole,
    })),
    designTokens: { styleMode: "corporate" },
    brandVoice: { tone: "Crisp", keywords: ["analytics"] },
    conversionGoal: "Book demo",
  });
}

describe("design system lock", () => {
  it("applies identical balanced padding to sections sharing spacingScale", () => {
    const planner = plannerFromHomePlan("saas", "split_authority");
    const balancedIds = planner.sectionPlan.filter((s) => s.spacingScale === "balanced").map((s) => s.id);
    expect(balancedIds.length).toBeGreaterThan(1);
    const ds = buildDesignSystemFromPlanner(planner);
    const doc: SiteSchemaDocumentType = {
      pages: [
        {
          slug: "/",
          blocks: balancedIds.slice(0, 2).map((id) => ({
            type: "paragraph" as const,
            content: { text: "x", aiSectionId: id },
          })),
        },
      ],
      metadata: { title: "T", designSystem: ds },
    };
    applyDesignSystemLockToDocument(doc, planner);
    const pads = doc.pages[0]!.blocks.map(
      (b) => (b.content as { style?: { padding?: number } }).style?.padding,
    );
    expect(pads[0]).toBe(pads[1]);
    expect(pads[0]).toBe(ds.lock!.sectionPaddingPx.balanced);
  });

  it("styles CTA blocks with locked radius and weight", () => {
    const planner = plannerFromHomePlan("saas", "conversion_funnel");
    const ctaRow = planner.sectionPlan.find((s) => s.registryKey === "mid_cta" || s.registryKey === "cta_glow_panel");
    expect(ctaRow).toBeTruthy();
    const ds = buildDesignSystemFromPlanner(planner);
    const doc: SiteSchemaDocumentType = {
      pages: [
        {
          slug: "/",
          blocks: [
            {
              type: "call_to_action",
              content: { title: "Go", body: "b", label: "OK", href: "#", aiSectionId: ctaRow!.id },
            },
          ],
        },
      ],
      metadata: { title: "T", designSystem: ds },
    };
    applyDesignSystemLockToDocument(doc, planner);
    const st = (doc.pages[0]!.blocks[0]!.content as { style?: Record<string, unknown> }).style;
    expect(st?.borderRadius).toBe(ds.lock?.cta.borderRadius);
    expect(st?.fontWeight).toBe(ds.lock?.cta.fontWeight);
  });
});
