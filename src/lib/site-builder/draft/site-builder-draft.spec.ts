import { SiteSchemaDocument } from "@/lib/site-builder/schema";
import { mapExecuteIntentMessage } from "@/lib/site-builder/assistant/map-execute-intent-message";
import { executeBuilderActions } from "@/lib/site-builder/builder-actions/execute-builder-actions";
import {
  filterDraftSafeBuilderActions,
  isSiteBuilderDraftMode,
  tryAttachToThemeOnlyDraft,
} from "@/lib/site-builder/draft/site-builder-draft";

function sampleDoc() {
  return SiteSchemaDocument.parse({
    pages: [
      {
        slug: "/",
        blocks: [
          {
            type: "hero",
            content: {
              aiSectionId: "sec-hero-1",
              aiRegistryKey: "hero_primary",
              title: "Headline",
              subtitle: "Sub",
            },
          },
        ],
      },
    ],
    metadata: { title: "T", governance: {} },
  });
}

describe("site-builder draft mode", () => {
  it("isSiteBuilderDraftMode is true when schema is valid and no site id", () => {
    const text = JSON.stringify(sampleDoc(), null, 2);
    expect(isSiteBuilderDraftMode(text, null)).toBe(true);
    expect(isSiteBuilderDraftMode(text, "")).toBe(true);
    expect(isSiteBuilderDraftMode(text, "site-1")).toBe(false);
  });

  it("isSiteBuilderDraftMode is false for invalid JSON", () => {
    expect(isSiteBuilderDraftMode("{", null)).toBe(false);
  });

  it("filterDraftSafeBuilderActions drops regenerate_section; keeps theme and add_section", () => {
    const mapped = mapExecuteIntentMessage({
      message: "make the site more modern and rewrite the hero",
      schema: sampleDoc(),
      editContext: { lastSectionIds: ["sec-hero-1"], lastPageSlug: "/" },
    });
    const { safe, dropped } = filterDraftSafeBuilderActions(mapped.actions);
    expect(dropped).toContain("regenerate_section");
    expect(safe.some((a) => a.action === "set_theme_tokens")).toBe(true);
    expect(safe.some((a) => a.action === "regenerate_section")).toBe(false);
  });

  it("background white maps to set_theme_tokens and applies via executeBuilderActions without siteId", async () => {
    const mapped = mapExecuteIntentMessage({
      message: "make the background white",
      schema: sampleDoc(),
      editContext: { lastSectionIds: [], lastPageSlug: "/" },
    });
    const { safe } = filterDraftSafeBuilderActions(tryAttachToThemeOnlyDraft(mapped.actions));
    expect(safe.some((a) => a.action === "set_theme_tokens")).toBe(true);

    const out = await executeBuilderActions({
      schemaJson: sampleDoc(),
      actions: safe,
      siteId: null,
    });
    const theme = out.schema.metadata?.theme;
    expect(theme?.backgroundMode).toBe("custom_color");
    expect(theme?.backgroundColor?.toLowerCase()).toBe("#ffffff");
  });

  it("add pricing in draft adds a section (add_section safe + execute)", async () => {
    const mapped = mapExecuteIntentMessage({
      message: "add a pricing section",
      schema: sampleDoc(),
      editContext: { lastSectionIds: [], lastPageSlug: "/" },
    });
    const { safe, dropped } = filterDraftSafeBuilderActions(mapped.actions);
    expect(dropped).toHaveLength(0);
    expect(safe[0]).toMatchObject({ action: "add_section" });

    const out = await executeBuilderActions({
      schemaJson: sampleDoc(),
      actions: safe,
      siteId: null,
    });
    const blocks = out.schema.pages[0]?.blocks ?? [];
    const pricing = blocks.find(
      (b) => b.type === "section" && String(b.content?.title || "").toLowerCase().includes("pricing"),
    );
    expect(pricing).toBeDefined();
  });

  it("with siteId, executeBuilderActions still accepts add_section (server path uses same actions)", async () => {
    const mapped = mapExecuteIntentMessage({
      message: "add a FAQ section",
      schema: sampleDoc(),
      editContext: { lastSectionIds: [], lastPageSlug: "/" },
    });
    const { safe } = filterDraftSafeBuilderActions(mapped.actions);
    const out = await executeBuilderActions({
      schemaJson: sampleDoc(),
      actions: safe,
      siteId: "saved-site-id",
    });
    const hasFaq = (out.schema.pages[0]?.blocks ?? []).some(
      (b) => String(b.content?.aiRegistryKey || "") === "faq" || /faq/i.test(String(b.content?.title || "")),
    );
    expect(hasFaq).toBe(true);
  });
});
