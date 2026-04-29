import { describe, expect, it } from "@jest/globals";
import type { SitePlannerOutput } from "@/lib/site-builder/ai/schemas";
import {
  buildDesignSystemFromPlanner,
  designSystemToCssRootBlock,
  ensureDesignSystemOnDocument,
} from "@/lib/site-builder/design-system";
import { generateStaticBundle } from "@/lib/site-builder/static-generator";
import type { SiteSchemaDocumentType } from "@/lib/site-builder/schema";

const minimalPlanner: SitePlannerOutput = {
  version: 1,
  intent: "saas",
  normalizedBrief: "Test",
  sitemap: [{ slug: "/", title: "Home", purpose: "" }],
  sectionPlan: [{ id: "a", registryKey: "hero_primary" }],
  designTokens: { styleMode: "minimal", accent: "#e2e8f0" },
  brandVoice: { tone: "calm", keywords: [] },
  conversionGoal: "demo",
};

describe("design system", () => {
  it("buildDesignSystemFromPlanner respects styleMode and accent", () => {
    const ds = buildDesignSystemFromPlanner(minimalPlanner);
    expect(ds.version).toBe(1);
    expect(ds.colors.accent).toContain("#");
    expect(ds.density).toBe("compact");
    expect(ds.motion.intensity).toBeGreaterThanOrEqual(0);
    expect(ds.lock?.sectionPaddingPx.balanced).toBeGreaterThan(0);
    expect(ds.lock?.typographyRem.body).toBeGreaterThan(0);
    expect(ds.lock?.cta.fontWeight).toBe(700);
  });

  it("designSystemToCssRootBlock emits :root variables", () => {
    const ds = buildDesignSystemFromPlanner(minimalPlanner);
    const css = designSystemToCssRootBlock(ds);
    expect(css).toContain(":root");
    expect(css).toContain("--ds-color-accent:");
    expect(css).toContain("--ds-space-section-y:");
  });

  it("generateStaticBundle embeds :root token block in site.css", () => {
    const doc: SiteSchemaDocumentType = {
      pages: [{ slug: "/", blocks: [{ type: "text", content: { body: "Hi" } }] }],
      metadata: { title: "X", designSystem: buildDesignSystemFromPlanner(minimalPlanner) },
    };
    const { files } = generateStaticBundle(doc);
    const css = files.find((f) => f.path === "assets/site.css")?.content ?? "";
    expect(css).toContain(":root");
    expect(css).toContain("--ds-color-accent");
  });

  it("ensureDesignSystemOnDocument backfills from theme", () => {
    const doc: SiteSchemaDocumentType = {
      pages: [{ slug: "/", blocks: [] }],
      metadata: {
        title: "T",
        theme: { styleMode: "corporate", gradientStart: "#111", gradientEnd: "#222" },
      },
    };
    const ds = ensureDesignSystemOnDocument(doc);
    expect(ds.colors.background).toBeTruthy();
    expect(doc.metadata?.designSystem).toBeTruthy();
  });
});
