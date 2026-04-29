import { SiteSchemaDocument, type SiteSchemaDocumentType } from "@/lib/site-builder/schema";

/** Stable UUID (variant + version nibble valid for Zod) for `zipAssetBaseName` / path checks. */
export const FIXTURE_IMAGE_ASSET_ID = "10000000-0000-4000-8000-000000000001";

export function deploymentRefinement(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    deploymentTarget: "static",
    routingMode: "single_page",
    assetStrategy: "local_bundle",
    ...overrides,
  };
}

const heroBlock = {
  type: "hero" as const,
  content: {
    title: "Fixture Hero Title",
    subtitle: "Fixture hero subtitle",
    visual: {},
  },
};

const textBlock = (body: string) => ({
  type: "text" as const,
  content: { body, visual: {} },
});

/** Static + corporate styleMode (body should carry data-troothertz-mode). */
export const fixtureStaticSingleCorporate: SiteSchemaDocumentType = SiteSchemaDocument.parse({
  pages: [{ slug: "/", blocks: [heroBlock, textBlock("FIXTURE_STATIC_SINGLE_BODY")] }],
  metadata: {
    title: "Fixture Corporate Static",
    description: "Deterministic single-page static export fixture.",
    theme: { styleMode: "corporate" },
    builderRefinement: deploymentRefinement({ deploymentTarget: "static" }),
  },
});

/** Static multi-page: slugs `/` and `/about` → index.html + about.html */
export const fixtureStaticMultiPage: SiteSchemaDocumentType = SiteSchemaDocument.parse({
  pages: [
    { slug: "/", blocks: [heroBlock, textBlock("FIXTURE_HOME_MULTI")] },
    { slug: "/about", blocks: [heroBlock, textBlock("FIXTURE_ABOUT_MULTI_MARKER")] },
  ],
  metadata: {
    title: "Fixture Static Multi",
    builderRefinement: deploymentRefinement({
      deploymentTarget: "static",
      routingMode: "multi_page",
    }),
  },
});

/** Vercel / Next.js multi-page App Router export. */
export const fixtureVercelMultiPage: SiteSchemaDocumentType = SiteSchemaDocument.parse({
  pages: [
    { slug: "/", blocks: [heroBlock, textBlock("FIXTURE_NEXT_HOME")] },
    { slug: "/about", blocks: [heroBlock, textBlock("FIXTURE_NEXT_ABOUT")] },
  ],
  metadata: {
    title: "Fixture Next Multi",
    theme: { styleMode: "minimal" },
    builderRefinement: deploymentRefinement({
      deploymentTarget: "vercel_nextjs",
      routingMode: "multi_page",
    }),
  },
});

/** Static single-page with web3 styleMode — `data-troothertz-mode` is emitted on `<body>` in full HTML. */
export const fixtureStaticWeb3: SiteSchemaDocumentType = SiteSchemaDocument.parse({
  pages: [{ slug: "/", blocks: [heroBlock, textBlock("FIXTURE_WEB3_STATIC_BODY")] }],
  metadata: {
    title: "Fixture Web3 Static",
    theme: { styleMode: "web3" },
    builderRefinement: deploymentRefinement({ deploymentTarget: "static" }),
  },
});

/** WordPress theme multi-page (optional template-*.php for extra routes). */
export const fixtureWordPressMulti: SiteSchemaDocumentType = SiteSchemaDocument.parse({
  pages: [
    { slug: "/", blocks: [heroBlock, textBlock("FIXTURE_WP_HOME")] },
    { slug: "/about", blocks: [heroBlock, textBlock("FIXTURE_WP_ABOUT")] },
  ],
  metadata: {
    title: "Fixture WP Multi Theme",
    builderRefinement: deploymentRefinement({
      deploymentTarget: "wordpress_theme",
      routingMode: "multi_page",
    }),
  },
});

/** GoHighLevel embed + multi-page (note file when multiple HTML artifacts). */
export const fixtureGhlMultiPage: SiteSchemaDocumentType = SiteSchemaDocument.parse({
  pages: [
    { slug: "/", blocks: [heroBlock, textBlock("FIXTURE_GHL_HOME")] },
    { slug: "/about", blocks: [heroBlock, textBlock("FIXTURE_GHL_ABOUT")] },
  ],
  metadata: {
    title: "Fixture GHL Multi",
    builderRefinement: deploymentRefinement({
      deploymentTarget: "gohighlevel_embed",
      routingMode: "multi_page",
    }),
  },
});

/**
 * Image block referencing a builder asset URL shape (for resolveAssetForExport tests).
 * No file on disk required — only resolution / path strings.
 */
export const fixtureWithBundledImageRef: SiteSchemaDocumentType = SiteSchemaDocument.parse({
  pages: [
    {
      slug: "/",
      blocks: [
        heroBlock,
        {
          type: "image" as const,
          content: {},
          src: `/api/site-builder/assets/${FIXTURE_IMAGE_ASSET_ID}`,
        },
      ],
    },
  ],
  metadata: {
    title: "Fixture Asset Paths",
    builderRefinement: deploymentRefinement({ deploymentTarget: "vercel_nextjs" }),
    siteBuilderAssets: {
      heroShot: {
        assetId: FIXTURE_IMAGE_ASSET_ID,
        kind: "image",
        originalName: "fixture.png",
        mimeType: "image/png",
        storagePath: "99/10000000-0000-4000-8000-000000000001.png",
      },
    },
  },
});
