import { describe, expect, it } from "@jest/globals";
import { applyBrandBrainAutofixes } from "@/lib/site-builder/brand-brain-autofix";
import { evaluateBrandBrain } from "@/lib/site-builder/brand-brain-evaluate";
import {
  applyBrandBrainAfterTroothertz,
  finalizeGenerationWithTroothertzAndBrandBrain,
  pickProactiveSuggestionLabels,
} from "@/lib/site-builder/brand-brain-pipeline";
import { applyBrandGovernanceToDocument } from "@/lib/site-builder/brand-governance";
import { SiteSchemaDocument, type SiteSchemaDocumentType } from "@/lib/site-builder/schema";

function minimalDoc(overrides?: Partial<SiteSchemaDocumentType>): SiteSchemaDocumentType {
  const doc: SiteSchemaDocumentType = {
    pages: [
      {
        slug: "/",
        blocks: [],
      },
    ],
    metadata: {
      title: "T",
      theme: { styleMode: "minimal" },
      designSystem: {
        version: 1,
        colors: {
          primary: "#38bdf8",
          accent: "#38bdf8",
          background: "#0f172a",
          surface: "#1e293b",
          text: "#f8fafc",
          textMuted: "#94a3b8",
        },
        typography: {
          fontSans: "sans-serif",
          scaleRootPx: 16,
          weightNormal: 400,
          weightSemibold: 600,
          weightBold: 700,
        },
        spacing: { sectionY: "3rem", xs: "0.25rem", sm: "0.5rem", md: "0.75rem", lg: "1rem", xl: "1.5rem" },
        radius: { sm: "6px", md: "10px", lg: "14px" },
        shadow: { sm: "0 1px 2px rgba(0,0,0,0.05)", md: "0 4px 14px rgba(0,0,0,0.08)", lg: "0 12px 28px rgba(0,0,0,0.1)" },
        motion: { durationFast: "0.15s", durationBase: "0.35s", easingStandard: "ease", intensity: 40 },
        density: "compact",
      },
    },
    ...overrides,
  };
  return SiteSchemaDocument.parse(doc);
}

describe("Brand Brain", () => {
  it("evaluateBrandBrain flags inconsistent CTA tones", () => {
    const doc = minimalDoc({
      pages: [
        {
          slug: "/",
          blocks: [
            {
              type: "hero",
              content: {
                aiSectionId: "a",
                aiRegistryKey: "hero_primary",
                title: "Hi",
                visual: { ctaTone: "primary", accent: "#38bdf8" },
              },
            },
            {
              type: "call_to_action",
              content: {
                aiSectionId: "b",
                aiRegistryKey: "mid_cta",
                visual: { ctaTone: "ghost", accent: "#38bdf8" },
              },
            },
          ],
        },
      ],
    });
    const { findings, scorecard } = evaluateBrandBrain(doc);
    expect(findings.some((f) => f.code === "cta_tone_inconsistent")).toBe(true);
    expect(scorecard.consistency).toBeLessThanOrEqual(100);
    expect(scorecard.consistency).toBeGreaterThanOrEqual(0);
  });

  it("applyBrandBrainAutofixes harmonizes CTA tones in safe_auto_apply mode", () => {
    const doc = minimalDoc({
      pages: [
        {
          slug: "/",
          blocks: [
            {
              type: "hero",
              content: {
                aiSectionId: "a",
                visual: { ctaTone: "ghost" },
              },
            },
            {
              type: "call_to_action",
              content: {
                aiSectionId: "b",
                visual: { ctaTone: "secondary" },
              },
            },
          ],
        },
      ],
    });
    const evaluation = evaluateBrandBrain(doc);
    const { touched, appliedCodes } = applyBrandBrainAutofixes(doc, evaluation, "safe_auto_apply");
    expect(touched).toBe(true);
    expect(appliedCodes).toContain("cta_tone_inconsistent");
    const h = doc.pages[0]!.blocks[0]!.content as { visual?: { ctaTone?: string } };
    expect(h.visual?.ctaTone).toBe("primary");
  });

  it("suggest_only does not mutate document", () => {
    const doc = minimalDoc({
      pages: [
        {
          slug: "/",
          blocks: [
            {
              type: "hero",
              content: { aiSectionId: "a", visual: { ctaTone: "ghost" } },
            },
            {
              type: "call_to_action",
              content: { aiSectionId: "b", visual: { ctaTone: "secondary" } },
            },
          ],
        },
      ],
    });
    const before = JSON.stringify(doc);
    const evaluation = evaluateBrandBrain(doc);
    const { touched } = applyBrandBrainAutofixes(doc, evaluation, "suggest_only");
    expect(touched).toBe(false);
    expect(JSON.stringify(doc)).toBe(before);
  });

  it("pickProactiveSuggestionLabels returns at most 3 items", () => {
    const queue = Array.from({ length: 8 }, (_, i) => ({
      code: `code_${i}`,
      severity: "info" as const,
      scope: "site" as const,
      fixability: "suggest" as const,
      autoApplied: false,
      surfacedAsSuggestion: true,
      label: `L${i}`,
      recommendation: "r",
    }));
    const picked = pickProactiveSuggestionLabels(queue, new Set(), 3);
    expect(picked.length).toBeLessThanOrEqual(3);
  });

  it("SiteSchemaDocument accepts optional metadata.brandBrain", () => {
    const doc = minimalDoc();
    applyBrandBrainAfterTroothertz(doc, doc, "suggest_only");
    const parsed = SiteSchemaDocument.safeParse(doc);
    expect(parsed.success).toBe(true);
    expect(parsed.data?.metadata?.brandBrain?.version).toBe(1);
    expect(Array.isArray(parsed.data?.metadata?.brandBrain?.findings)).toBe(true);
  });

  it("finalizeGenerationWithTroothertzAndBrandBrain uses governance path (no duplicate styling model)", () => {
    const doc = minimalDoc({
      pages: [
        {
          slug: "/",
          blocks: [
            {
              type: "hero",
              content: {
                aiSectionId: "x",
                aiRegistryKey: "hero_primary",
                title: "Hello",
                visual: { accent: "#ff00ff", ctaTone: "ghost" },
              },
            },
            {
              type: "call_to_action",
              content: {
                aiSectionId: "y",
                aiRegistryKey: "mid_cta",
                visual: { accent: "#ff00ff", ctaTone: "secondary" },
              },
            },
          ],
        },
      ],
    });
    finalizeGenerationWithTroothertzAndBrandBrain(doc);
    const governed = applyBrandGovernanceToDocument(doc);
    expect(typeof governed).toBe("boolean");
    expect(doc.metadata?.brandBrain?.decisionMode).toBe("safe_auto_apply");
  });
});
