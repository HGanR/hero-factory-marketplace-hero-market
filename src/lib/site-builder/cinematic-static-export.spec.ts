import { describe, expect, it } from "@jest/globals";
import { buildCinematicBackgroundFromVisualMeta, heroCinematicStackCss } from "@/lib/site-builder/cinematic-static-export";
import { generateStaticBundle } from "@/lib/site-builder/static-generator";
import type { SiteSchemaDocumentType } from "@/lib/site-builder/schema";

describe("buildCinematicBackgroundFromVisualMeta", () => {
  const theme = {
    backgroundMode: "simple_gradients",
    gradientStart: "#0f172a",
    gradientEnd: "#1e293b",
    customGradient: "",
    backgroundColor: "#020617",
  };

  it("adds multi-layer background from visualMeta", () => {
    const out = buildCinematicBackgroundFromVisualMeta(
      {
        gradientStyle: "mesh",
        backgroundStyle: "gradient",
        lightingStyle: "neon-glow",
        layoutFamilyId: "x",
      },
      theme,
    );
    expect(out.bodyStyle).toContain("background-image:");
    expect(out.bodyStyle).toContain("radial-gradient");
    expect(out.bodyStyle).toContain("linear-gradient");
    expect(out.styleBlock).toContain("--cinematic-accent");
  });

  it("injects photo + vignette for image-overlay", () => {
    const out = buildCinematicBackgroundFromVisualMeta(
      {
        gradientStyle: "linear",
        backgroundStyle: "image-overlay",
        lightingStyle: "ambient",
      },
      theme,
    );
    expect(out.overlayHtml).toContain("cinematic-bg-photo");
    expect(out.overlayHtml).toContain("images.unsplash.com");
    expect(out.bodyStyle).toContain("background-color:#020617");
  });
});

describe("heroCinematicStackCss", () => {
  it("adds layers when doc has visualMeta and gradient is short", () => {
    const css = heroCinematicStackCss({ gradient: "" }, true);
    expect(css).toContain("background-image");
  });

  it("skips when doc has no visualMeta flag", () => {
    expect(heroCinematicStackCss({}, false)).toBe("");
  });
});

describe("generateStaticBundle cinematic parity", () => {
  const base: SiteSchemaDocumentType = {
    pages: [
      {
        slug: "/",
        blocks: [
          {
            type: "hero",
            content: {
              title: "Hello",
              visual: { gradient: "linear-gradient(135deg, #0f172a, #1e293b)" },
            },
          },
          { type: "section", content: { title: "A", body: "B" } },
        ],
      },
    ],
    metadata: {
      title: "T",
      theme: {
        backgroundMode: "simple_gradients",
        gradientStart: "#0f172a",
        gradientEnd: "#1e293b",
      },
      visualMeta: {
        gradientStyle: "mesh",
        backgroundStyle: "gradient",
        lightingStyle: "soft",
      },
    },
  };

  it("HTML includes layered body background and section wraps", () => {
    const { files } = generateStaticBundle(base);
    const html = files.find((f) => f.path === "index.html")?.content ?? "";
    expect(html).toContain("background-image");
    expect(html).toContain('data-cinematic="1"');
    expect(html).toContain("cine-sec");
  });

  it("hero is not flat when visualMeta set and gradient minimal", () => {
    const doc: SiteSchemaDocumentType = {
      ...base,
      pages: [
        {
          slug: "/",
          blocks: [
            {
              type: "hero",
              content: {
                title: "H",
                visual: { gradient: "" },
              },
            },
          ],
        },
      ],
    };
    const { files } = generateStaticBundle(doc);
    const html = files.find((f) => f.path === "index.html")?.content ?? "";
    expect(html).toContain("thz-hero-cinematic");
    expect(html).toContain("radial-gradient");
  });
});
