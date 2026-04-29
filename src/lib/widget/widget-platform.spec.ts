import { describe, expect, it } from "@jest/globals";
import { buildSiteWidgetSummaryFromSchemaJson } from "@/lib/widget/site-schema-widget-summary";
import {
  mergeWidgetBindingMetadata,
  parseWidgetBindingMetadata,
  widgetMetadataPatchFromRequestBody,
} from "@/lib/widget/widget-binding-metadata";
import { mergeWidgetIntegrationIntoSiteSchema } from "@/lib/site-builder/merge-widget-integration";

describe("widget platform metadata", () => {
  it("parses binding metadata and merges patches", () => {
    const base = parseWidgetBindingMetadata({ providerStrategy: "agent", welcomeMessage: "Hello" });
    expect(base.providerStrategy).toBe("agent");
    const merged = mergeWidgetBindingMetadata(base, { providerStrategy: "site_builder" });
    expect(merged.providerStrategy).toBe("site_builder");
    expect(merged.welcomeMessage).toBe("Hello");
  });

  it("extracts HTTP body patch fields", () => {
    const p = widgetMetadataPatchFromRequestBody({
      providerStrategy: "site_builder",
      title: "Support",
      widgetVisual: { launcherPosition: "left", theme: "light", accent: "#ff00aa" },
      widgetAppearance: {
        avatarBorderColor: "#0000ff",
        widgetBubbleColor: "white",
        widgetHeaderColor: "navy",
        avatarBorderWidth: 3,
      },
    });
    expect(p.providerStrategy).toBe("site_builder");
    expect(p.title).toBe("Support");
    expect(p.visual?.launcherPosition).toBe("left");
    expect(p.widgetAppearance?.avatarBorderColor).toBe("#0000ff");
    expect(p.widgetAppearance?.widgetBubbleColor).toBe("white");
    expect(p.widgetAppearance?.widgetHeaderColor).toBe("navy");
  });
});

describe("site widget summary", () => {
  it("builds a short summary from schema JSON", () => {
    const doc = {
      pages: [
        {
          slug: "/",
          blocks: [
            { type: "heading", content: { title: "Acme Co", aiSectionId: "h1" } },
            { type: "paragraph", content: { body: "We ship fast.", aiSectionId: "p1" } },
          ],
        },
      ],
      metadata: { title: "Acme", description: "Widgets test", governance: {} },
    };
    const s = buildSiteWidgetSummaryFromSchemaJson(JSON.stringify(doc));
    expect(s).toBeTruthy();
    expect(s!).toContain("Acme");
    expect(s!).toContain("We ship fast.");
  });
});

describe("merge widget into site schema", () => {
  it("sets metadata.widgetIntegration.widgetKey", () => {
    const doc = {
      pages: [{ slug: "/", blocks: [{ type: "paragraph", content: { body: "x", aiSectionId: "a" } }] }],
      metadata: { title: "T", governance: {} },
    };
    const out = mergeWidgetIntegrationIntoSiteSchema(doc, {
      widgetKey: "abcdefghijklmnop",
      loaderOrigin: "https://app.example.com",
    });
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.schema.metadata?.widgetIntegration?.widgetKey).toBe("abcdefghijklmnop");
      expect(out.schema.metadata?.widgetIntegration?.loaderOrigin).toBe("https://app.example.com");
    }
  });
});
