import { describe, expect, it } from "@jest/globals";
import { generateSiteSchemaFromPlanner } from "@/lib/site-builder/ai/generator";
import { runSitePlanner } from "@/lib/site-builder/ai/planner";
import { SiteSchemaDocument } from "@/lib/site-builder/schema";
import {
  BuilderActionsRequestSchema,
  BuilderActionSchema,
  executeBuilderActions,
} from "@/lib/site-builder/builder-actions";
import { buildDeploymentProjectFromSchema } from "@/lib/site-builder/project-export/orchestrate";

async function minimalSchema() {
  const { output } = await runSitePlanner({
    userPrompt: "Simple landing",
    siteType: "landing",
    styleIntensity: 40,
    web3VisualMode: false,
  });
  return generateSiteSchemaFromPlanner(output);
}

describe("builder-actions", () => {
  it("BuilderActionsRequestSchema rejects unknown action", () => {
    const r = BuilderActionsRequestSchema.safeParse({
      schemaJson: { pages: [{ slug: "/", blocks: [] }], metadata: { title: "T", governance: {} } },
      actions: [{ action: "not_a_real_action" }],
    });
    expect(r.success).toBe(false);
  });

  it("BuilderActionSchema accepts add_section", () => {
    const r = BuilderActionSchema.safeParse({
      action: "add_section",
      pageSlug: "/",
      template: "paragraph",
    });
    expect(r.success).toBe(true);
  });

  it("remove_section requires exactly one of index, aiSectionId, or target", () => {
    const r = BuilderActionSchema.safeParse({
      action: "remove_section",
      pageSlug: "/",
    });
    expect(r.success).toBe(false);
  });

  it("add_section, move_section, remove_section mutate home blocks deterministically", async () => {
    const base = await minimalSchema();
    const before = base.pages[0]!.blocks.length;
    const out = await executeBuilderActions({
      schemaJson: base,
      actions: [
        { action: "add_section", pageSlug: "/", template: "heading", index: 1 },
        { action: "move_section", pageSlug: "/", fromIndex: 1, toIndex: 0 },
      ],
    });
    expect(out.results.every((x) => x.ok)).toBe(true);
    expect(out.schema.pages[0]!.blocks.length).toBe(before + 1);
    const headingAt0 = out.schema.pages[0]!.blocks[0];
    expect(headingAt0?.type).toBe("heading");

    const sid = String((headingAt0!.content as { aiSectionId?: string }).aiSectionId || "");
    expect(sid.length).toBeGreaterThan(3);

    const out2 = await executeBuilderActions({
      schemaJson: out.schema,
      actions: [{ action: "remove_section", pageSlug: "/", aiSectionId: sid }],
    });
    expect(out2.results[0]!.ok).toBe(true);
    expect(out2.schema.pages[0]!.blocks.length).toBe(before);
  });

  it("normalize_imported_markup leaves schema unchanged", async () => {
    const base = await minimalSchema();
    const html =
      "<html><head><title>Acme</title></head><body><h1>Hello</h1><p>Body</p><a href='/x'>Go</a></body></html>";
    const out = await executeBuilderActions({
      schemaJson: base,
      actions: [{ action: "normalize_imported_markup", html, sourceUrl: "https://example.com/" }],
    });
    expect(out.results[0]!.ok).toBe(true);
    expect(out.results[0]!.details?.sectionCount).toBeGreaterThanOrEqual(0);
    expect(out.schema.pages[0]!.blocks.length).toBe(base.pages[0]!.blocks.length);
  });

  it("map_html_to_schema replaces document with non-empty home", async () => {
    const base = await minimalSchema();
    const html =
      "<html><head><title>Imported Co</title></head><body><h1>Welcome</h1><p>We build things.</p></body></html>";
    const out = await executeBuilderActions({
      schemaJson: base,
      actions: [{ action: "map_html_to_schema", html, sourceUrl: "https://import.test/" }],
    });
    expect(out.results[0]!.ok).toBe(true);
    const hb = out.schema.pages[0]!.blocks.length;
    expect(hb).toBeGreaterThan(0);
    const parsed = SiteSchemaDocument.safeParse(out.schema);
    expect(parsed.success).toBe(true);
  });

  it("export_project_validate runs buildDeploymentProjectFromSchema", async () => {
    const base = await minimalSchema();
    const out = await executeBuilderActions({
      schemaJson: base,
      actions: [{ action: "export_project_validate" }],
      userId: 1,
    });
    expect(out.results[0]!.ok).toBe(true);
    const files = await buildDeploymentProjectFromSchema(out.schema, { userId: 1 });
    expect(files.length).toBeGreaterThan(0);
  });

  it("import_blueprint_from_url surfaces blocked host without throwing", async () => {
    const base = await minimalSchema();
    const out = await executeBuilderActions({
      schemaJson: base,
      actions: [{ action: "import_blueprint_from_url", url: "https://127.0.0.1/nope" }],
    });
    expect(out.results[0]!.ok).toBe(false);
    expect(String(out.results[0]!.message)).toMatch(/not allowed|blocked/i);
    expect(out.abortedAt).toBe(0);
    expect(out.schema.pages[0]!.blocks.length).toBe(base.pages[0]!.blocks.length);
  });

  it("regenerate_section chains via executeBuilderActions", async () => {
    const base = await minimalSchema();
    const firstSection = (await runSitePlanner({
      userPrompt: "Simple landing",
      siteType: "landing",
      styleIntensity: 40,
      web3VisualMode: false,
    })).output.sectionPlan[0]!;
    const out = await executeBuilderActions({
      schemaJson: base,
      actions: [
        {
          action: "regenerate_section",
          sectionId: firstSection.id,
          instruction: "Tighten hero copy",
        },
      ],
    });
    expect(out.results[0]!.ok).toBe(true);
    expect(out.sessionEditContext?.lastSectionId).toBe(firstSection.id);
    SiteSchemaDocument.parse(out.schema);
  });

  it("regression: imported HTML maps to home with at least one block (not empty preview)", async () => {
    const base = await minimalSchema();
    const html = "<html><body></body></html>";
    const out = await executeBuilderActions({
      schemaJson: base,
      actions: [{ action: "map_html_to_schema", html, sourceUrl: "https://empty.test/" }],
    });
    expect(out.results[0]!.ok).toBe(true);
    expect(out.schema.pages[0]!.blocks.length).toBeGreaterThan(0);
  });

  it("update_copy resolves target by blockIndex", async () => {
    const base = await minimalSchema();
    const out = await executeBuilderActions({
      schemaJson: base,
      actions: [
        {
          action: "update_copy",
          pageSlug: "/",
          target: { pageSlug: "/", blockIndex: 0 },
          patches: { title: "Resolved title" },
        },
      ],
    });
    expect(out.results[0]!.ok).toBe(true);
    const b0 = out.schema.pages[0]!.blocks[0]!;
    expect((b0.content as { title?: string }).title).toBe("Resolved title");
  });

  it("remove_section accepts target descriptor", async () => {
    const base = await minimalSchema();
    const n = base.pages[0]!.blocks.length;
    expect(n).toBeGreaterThan(1);
    const out = await executeBuilderActions({
      schemaJson: base,
      actions: [{ action: "remove_section", pageSlug: "/", target: { pageSlug: "/", blockIndex: n - 1 } }],
    });
    expect(out.results[0]!.ok).toBe(true);
    expect(out.schema.pages[0]!.blocks.length).toBe(n - 1);
  });

  it("regenerate_section accepts target instead of sectionId", async () => {
    const base = await minimalSchema();
    const out = await executeBuilderActions({
      schemaJson: base,
      actions: [
        { action: "regenerate_section", target: { pageSlug: "/", blockIndex: 0 }, instruction: "Tighten hero" },
      ],
    });
    expect(out.results[0]!.ok).toBe(true);
    SiteSchemaDocument.parse(out.schema);
  });

  it("set_section_background writes content.style.backgroundColor for live preview", async () => {
    const base = SiteSchemaDocument.parse({
      pages: [
        {
          slug: "/",
          blocks: [{ type: "section", content: { aiSectionId: "sec-a", title: "T", body: "b" } }],
        },
      ],
      metadata: { title: "T", governance: {} },
    });
    const out = await executeBuilderActions({
      schemaJson: base,
      actions: [{ action: "set_section_background", pageSlug: "/", sectionId: "sec-a", color: "#ffffff" }],
    });
    expect(out.results[0]!.ok).toBe(true);
    const style = (out.schema.pages[0]!.blocks[0]!.content as { style?: { backgroundColor?: string } }).style;
    expect(style?.backgroundColor).toBe("#ffffff");
  });

  it("set_theme_tokens with custom white background sets theme.backgroundColor and readable designSystem text", async () => {
    const base = await minimalSchema();
    const out = await executeBuilderActions({
      schemaJson: base,
      actions: [
        {
          action: "set_theme_tokens",
          styleMode: "minimal",
          backgroundMode: "custom_color",
          backgroundColor: "#ffffff",
          gradientStart: "#ffffff",
          gradientEnd: "#ffffff",
        },
      ],
    });
    expect(out.results[0]!.ok).toBe(true);
    expect(out.schema.metadata?.theme?.backgroundMode).toBe("custom_color");
    expect(out.schema.metadata?.theme?.backgroundColor).toBe("#ffffff");
    expect(out.schema.metadata?.designSystem?.colors.text).toMatch(/^#0f172a$/i);
  });
});
