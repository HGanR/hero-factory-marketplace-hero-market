import { describe, expect, it } from "@jest/globals";
import {
  applySectionStylePreset,
  applyThemePresetTokens,
  critiqueBadgeForScore,
  createVisualLibraryBlock,
  duplicateSectionById,
  getVisualSections,
  moveSectionById,
  mutateVisualSchema,
  parseVisualDoc,
  reorderSectionBySnapDrop,
  reorderSectionByDropTarget,
  replaceFirstTextInSection,
  removeSectionById,
  suggestMissingSections,
  updateSectionById,
} from "@/lib/site-builder/visual-editor";

const BASE_SCHEMA = JSON.stringify({
  pages: [
    {
      slug: "/",
      blocks: [
        { type: "hero", content: { aiSectionId: "hero-1", title: "Hero" } },
        { type: "call_to_action", content: { aiSectionId: "cta-1", title: "CTA", label: "Start", href: "#" } },
      ],
    },
  ],
  metadata: {},
});

describe("visual editor schema helpers", () => {
  it("layer selection resolves section ids", () => {
    const sections = getVisualSections(BASE_SCHEMA);
    expect(sections.map((s) => s.id)).toEqual(["hero-1", "cta-1"]);
  });

  it("property changes update the selected section", () => {
    const next = mutateVisualSchema(BASE_SCHEMA, (doc) => {
      updateSectionById(doc, "cta-1", (block) => {
        block.content.style = { backgroundColor: "#111827" };
      });
    });
    const parsed = parseVisualDoc(next);
    const cta = parsed.pages?.[0]?.blocks?.[1] as any;
    expect(cta.content.style.backgroundColor).toBe("#111827");
  });

  it("reorder updates section order for preview", () => {
    const next = mutateVisualSchema(BASE_SCHEMA, (doc) => {
      moveSectionById(doc, "cta-1", -1);
    });
    expect(getVisualSections(next).map((s) => s.id)).toEqual(["cta-1", "hero-1"]);
  });

  it("drag reorder helper updates schema order by target", () => {
    const next = mutateVisualSchema(BASE_SCHEMA, (doc) => {
      reorderSectionByDropTarget(doc, "cta-1", "hero-1");
    });
    expect(getVisualSections(next).map((s) => s.id)).toEqual(["cta-1", "hero-1"]);
  });

  it("snap drop reorder supports before/after placement", () => {
    const next = mutateVisualSchema(BASE_SCHEMA, (doc) => {
      reorderSectionBySnapDrop(doc, "hero-1", "cta-1", "after");
    });
    expect(getVisualSections(next).map((s) => s.id)).toEqual(["cta-1", "hero-1"]);
  });

  it("inline text edit helper updates section text", () => {
    const next = mutateVisualSchema(BASE_SCHEMA, (doc) => {
      replaceFirstTextInSection(doc, "hero-1", "Hero", "Hero updated");
    });
    const parsed = parseVisualDoc(next);
    expect((parsed.pages?.[0]?.blocks?.[0] as any)?.content?.title).toBe("Hero updated");
  });

  it("duplicate adds a copied section", () => {
    const next = mutateVisualSchema(BASE_SCHEMA, (doc) => {
      duplicateSectionById(doc, "cta-1");
    });
    expect(getVisualSections(next)).toHaveLength(3);
  });

  it("delete removes a section", () => {
    const next = mutateVisualSchema(BASE_SCHEMA, (doc) => {
      removeSectionById(doc, "hero-1");
    });
    expect(getVisualSections(next).map((s) => s.id)).toEqual(["cta-1"]);
  });

  it("component library creates section blocks with targeting id", () => {
    const block = createVisualLibraryBlock("call_to_action", "pricing");
    expect(String((block as any)?.content?.aiSectionId || "")).not.toBe("");
  });

  it("applies style preset and updates theme tokens", () => {
    const next = mutateVisualSchema(BASE_SCHEMA, (doc) => {
      applySectionStylePreset(doc, "hero-1", "web3");
      applyThemePresetTokens(doc, "web3");
    });
    const parsed = parseVisualDoc(next) as any;
    expect(parsed.pages[0].blocks[0].content.style.backgroundColor).toBe("#111827");
    expect(parsed.metadata.theme.tokens.sectionPreset).toBe("web3");
  });

  it("returns critique badges and smart component suggestions", () => {
    expect(critiqueBadgeForScore(80)).toBe("strong");
    expect(critiqueBadgeForScore(20)).toBe("needs_improvement");
    expect(suggestMissingSections(BASE_SCHEMA).length).toBeGreaterThan(0);
  });
});
