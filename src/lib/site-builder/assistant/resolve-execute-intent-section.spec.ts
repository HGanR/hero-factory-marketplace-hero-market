import { SiteSchemaDocument } from "@/lib/site-builder/schema";
import { resolveSectionIdForExecuteIntent } from "@/lib/site-builder/assistant/resolve-execute-intent-section";

describe("resolveSectionIdForExecuteIntent", () => {
  const doc = SiteSchemaDocument.parse({
    pages: [
      {
        slug: "/",
        blocks: [
          {
            type: "hero",
            content: { aiSectionId: "hero-1", aiRegistryKey: "hero_primary", title: "T", subtitle: "s" },
          },
        ],
      },
    ],
    metadata: { title: "x", governance: {} },
  });

  it("resolves hero keyword", () => {
    const r = resolveSectionIdForExecuteIntent(doc, "/", "please refresh the hero", []);
    expect(r).toEqual({ ok: true, sectionId: "hero-1" });
  });

  it("uses lastSectionIds for generic edit", () => {
    const r = resolveSectionIdForExecuteIntent(doc, "/", "shorten the copy on this section", ["hero-1"]);
    expect(r).toEqual({ ok: true, sectionId: "hero-1" });
  });
});
