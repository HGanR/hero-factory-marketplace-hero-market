/** @jest-environment node */
import { ImportBlueprintSchema } from "@/lib/site-builder/site-import/import-blueprint";
import { analyzeImportedBlueprint } from "@/lib/site-builder/site-import/semantic-reconstruction";
import { importBlueprintToSiteSchema } from "@/lib/site-builder/site-import/blueprint-to-schema";
import { SiteSchemaDocument } from "@/lib/site-builder/schema";

describe("semantic reconstruction", () => {
  it("injects MVP sections when blueprint is empty", () => {
    const raw = ImportBlueprintSchema.parse({
      version: 1,
      sourceUrl: "https://example.com/",
      title: "Example Co",
      metaDescription: "We build things.",
      sections: [],
    });
    const enriched = analyzeImportedBlueprint(raw);
    expect(enriched.sections.length).toBeGreaterThanOrEqual(3);
    expect(enriched.sections.some((s) => s.kind === "hero")).toBe(true);
    expect(enriched.sections.some((s) => s.kind === "cta")).toBe(true);
    expect(enriched.reconstruction?.path).toMatch(/metadata_mvp|semantic_enriched/);
  });

  it("maps enriched blueprint to non-empty home blocks with reconstruction metadata", () => {
    const raw = ImportBlueprintSchema.parse({
      version: 1,
      sourceUrl: "https://spa.example/",
      ogTitle: "OG Title",
      metaDescription: "Desc",
      sections: [],
    });
    const enriched = analyzeImportedBlueprint(raw);
    const doc = importBlueprintToSiteSchema(enriched);
    expect(doc.pages[0]?.blocks?.length ?? 0).toBeGreaterThan(0);
    expect(doc.metadata?.siteImport?.reconstruction?.path).toBeDefined();
    expect(SiteSchemaDocument.safeParse(doc).success).toBe(true);
  });

  it("ranks hero_candidate image into heroBackgroundImageUrl", () => {
    const raw = ImportBlueprintSchema.parse({
      version: 1,
      sourceUrl: "https://x.com/",
      sections: [
        {
          id: "m1",
          kind: "media",
          heading: "Hero",
          imageUrls: ["https://x.com/a.jpg"],
          imageRole: "hero_candidate",
        },
        {
          id: "m2",
          kind: "media",
          heading: "Tiny",
          imageUrls: ["https://x.com/b.jpg"],
          imageRole: "decorative",
        },
      ],
    });
    const enriched = analyzeImportedBlueprint(raw);
    expect(enriched.heroBackgroundImageUrl).toContain("a.jpg");
  });
});
