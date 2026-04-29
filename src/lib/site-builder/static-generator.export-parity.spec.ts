import { generateStaticBundle } from "@/lib/site-builder/static-generator";
import { SiteSchemaDocument } from "@/lib/site-builder/schema";

describe("static-generator export parity (TROOTHHERTZ / preview)", () => {
  it("scopes default card chrome away from self-contained blocks and exposes style mode", () => {
    const doc = SiteSchemaDocument.parse({
      pages: [
        {
          slug: "/",
          blocks: [
            {
              type: "hero",
              content: {
                title: "Hero",
                subtitle: "Sub",
                visual: { gradient: "linear-gradient(135deg, rgba(30,27,75,0.9), rgba(15,23,42,0.95))" },
              },
            },
            {
              type: "stat_band",
              content: {
                stats: [{ value: "12", label: "Signals" }],
                visual: { gradient: "linear-gradient(90deg,transparent,rgba(56,189,248,0.12),transparent)" },
              },
            },
            {
              type: "call_to_action",
              content: { title: "CTA", body: "Next", label: "Go", href: "/" },
            },
          ],
        },
      ],
      metadata: {
        title: "Parity",
        theme: { styleMode: "minimal" },
      },
    });

    const { files } = generateStaticBundle(doc);
    const css = files.find((f) => f.path === "assets/site.css")!.content;
    const html = files.find((f) => f.path === "index.html")!.content;

    expect(css).toContain(":not(.hero-rich)");
    expect(css).toContain(":not(.stat-band)");
    expect(css).toContain(":not(.image-grid-block)");
    expect(css).toContain(":not(.cta-block)");
    expect(html).toContain('data-troothertz-mode="minimal"');
    expect(html).toMatch(/<section[^>]*class="hero hero-rich[^"]*"/);
  });
});
