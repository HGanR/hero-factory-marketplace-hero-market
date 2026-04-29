import { describe, expect, it } from "@jest/globals";
import { SiteSchemaDocument } from "@/lib/site-builder/schema";
import {
  normalizeSchemaJsonStringForTargeting,
  normalizeSiteDocumentBlockTargeting,
} from "@/lib/site-builder/schema/ensure-block-targeting";
import { getPreviewBlockSectionMeta } from "@/lib/site-builder/preview/blockPreviewUtils";

describe("ensure-block-targeting", () => {
  it("fills missing aiSectionId and aiRegistryKey without clobbering existing", () => {
    const raw = {
      pages: [
        {
          slug: "/",
          blocks: [
            { type: "hero", content: { title: "A", aiSectionId: "keep-me", aiRegistryKey: "hero_primary" } },
            { type: "text", content: { body: "B" } },
          ],
        },
      ],
      metadata: { title: "T", governance: {} },
    };
    const parsed = SiteSchemaDocument.parse(raw);
    normalizeSiteDocumentBlockTargeting(parsed);
    const h = parsed.pages[0]!.blocks[0]!.content as { aiSectionId?: string; aiRegistryKey?: string };
    const t = parsed.pages[0]!.blocks[1]!.content as { aiSectionId?: string; aiRegistryKey?: string };
    expect(h.aiSectionId).toBe("keep-me");
    expect(h.aiRegistryKey).toBe("hero_primary");
    expect(t.aiSectionId?.length).toBeGreaterThan(4);
    expect(t.aiRegistryKey).toBe("paragraph_intro");
  });

  it("normalizeSchemaJsonStringForTargeting leaves invalid JSON unchanged", () => {
    const bad = "{not json";
    expect(normalizeSchemaJsonStringForTargeting(bad)).toBe(bad);
  });

  it("getPreviewBlockSectionMeta returns targetable id after normalization", () => {
    const s = normalizeSchemaJsonStringForTargeting(
      JSON.stringify({
        pages: [{ slug: "/", blocks: [{ type: "paragraph", content: { text: "x" } }] }],
        metadata: { title: "T", governance: {} },
      }),
    );
    const doc = JSON.parse(s) as { pages: { blocks: unknown[] }[] };
    const meta = getPreviewBlockSectionMeta(doc.pages[0]!.blocks[0]);
    expect(meta.sectionId).toBeTruthy();
    expect(meta.sectionType).toBe("paragraph");
  });
});
