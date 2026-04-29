import { describe, expect, it } from "@jest/globals";
import { SiteSchemaDocument } from "@/lib/site-builder/schema";
import {
  resolveSectionTarget,
  SectionResolveError,
  hasNonemptyTarget,
} from "@/lib/site-builder/builder-actions/resolve-section-target";

const doc = SiteSchemaDocument.parse({
  pages: [
    {
      slug: "/",
      blocks: [
        {
          type: "hero",
          content: { aiSectionId: "s-hero", aiRegistryKey: "hero_primary", title: "H", subtitle: "" },
        },
        {
          type: "paragraph",
          content: { aiSectionId: "s-p1", aiRegistryKey: "paragraph_intro", text: "A" },
        },
        {
          type: "paragraph",
          content: { aiSectionId: "s-p2", aiRegistryKey: "paragraph_intro", text: "B" },
        },
      ],
    },
  ],
  metadata: { title: "T", governance: {} },
});

describe("resolveSectionTarget", () => {
  it("resolves by blockIndex", () => {
    const r = resolveSectionTarget(doc, { pageSlug: "/", blockIndex: 1 });
    expect(r.aiSectionId).toBe("s-p1");
    expect(r.blockType).toBe("paragraph");
  });

  it("resolves by blockType + ordinal", () => {
    const r = resolveSectionTarget(doc, { pageSlug: "/", blockType: "paragraph", ordinal: 2 });
    expect(r.aiSectionId).toBe("s-p2");
  });

  it("resolves single match without ordinal", () => {
    const r = resolveSectionTarget(doc, { pageSlug: "/", blockType: "hero" });
    expect(r.aiSectionId).toBe("s-hero");
  });

  it("throws AMBIGUOUS for multiple paragraphs without ordinal", () => {
    expect(() => resolveSectionTarget(doc, { pageSlug: "/", blockType: "paragraph" })).toThrow(SectionResolveError);
    try {
      resolveSectionTarget(doc, { pageSlug: "/", blockType: "paragraph" });
    } catch (e) {
      expect(e).toBeInstanceOf(SectionResolveError);
      expect((e as SectionResolveError).code).toBe("AMBIGUOUS");
    }
  });

  it("hasNonemptyTarget", () => {
    expect(hasNonemptyTarget({ pageSlug: "/", blockIndex: 0 })).toBe(true);
    expect(hasNonemptyTarget({ pageSlug: "/" })).toBe(false);
  });
});
