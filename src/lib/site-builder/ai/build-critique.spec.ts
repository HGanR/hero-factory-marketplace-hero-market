import { describe, expect, it } from "@jest/globals";
import { SiteSchemaDocument } from "@/lib/site-builder/schema";
import { applyBuildCritiqueRepairs, critiqueSiteBuild, CRITIQUE_THRESHOLD } from "@/lib/site-builder/ai/build-critique";
import { ContentBriefSchema } from "@/lib/site-builder/ai/content-brief-schema";

describe("build-critique", () => {
  it("flags generic duplicate headlines and low surface variety", () => {
    const doc = SiteSchemaDocument.parse({
      pages: [
        {
          slug: "/",
          blocks: [
            {
              type: "hero",
              content: {
                aiSectionId: "h1",
                title: "Professional services and advisory for growth",
                subtitle: "Professional services and advisory for growth",
                primaryCta: "Learn more",
              },
            },
            {
              type: "section",
              content: { aiSectionId: "s1", title: "Professional services and advisory for growth", body: "x" },
            },
            {
              type: "section",
              content: { aiSectionId: "s2", title: "More services", body: "y" },
            },
            {
              type: "section",
              content: { aiSectionId: "s3", title: "Even more", body: "z" },
            },
          ],
        },
      ],
      metadata: { title: "T", governance: {} },
    });
    const pack = critiqueSiteBuild(doc, "Web3 consulting firm");
    expect(pack.score).toBeLessThan(CRITIQUE_THRESHOLD);
    expect(pack.issues.length).toBeGreaterThan(0);
  });

  it("auto-repair varies section backgrounds when critique is low", () => {
    const doc = SiteSchemaDocument.parse({
      pages: [
        {
          slug: "/",
          blocks: [
            { type: "hero", content: { aiSectionId: "h1", title: "Professional services", subtitle: "x" } },
            { type: "section", content: { aiSectionId: "a1", title: "Professional services", body: "b" } },
            { type: "section", content: { aiSectionId: "a2", title: "Professional services", body: "c" } },
            { type: "section", content: { aiSectionId: "a3", title: "Professional services", body: "d" } },
          ],
        },
      ],
      metadata: { title: "T", governance: {} },
    });
    const brief = ContentBriefSchema.parse({
      industry: "Web3 security",
      primaryOffer: "Audit and ship with confidence",
      ctaPrimary: "Book a security review",
      ctaSecondary: "View findings sample",
      keywordTargets: ["wallet", "governance"],
    });
    const pack = critiqueSiteBuild(doc, "Web3 consulting firm");
    const { doc: next, repaired } = applyBuildCritiqueRepairs(doc, brief, pack);
    expect(repaired).toBe(true);
    const styles = (next.pages[0]!.blocks || []).map(
      (b) => (b.content as { style?: { backgroundColor?: string } })?.style?.backgroundColor,
    );
    const uniq = new Set(styles.filter(Boolean));
    expect(uniq.size).toBeGreaterThan(1);
  });
});
