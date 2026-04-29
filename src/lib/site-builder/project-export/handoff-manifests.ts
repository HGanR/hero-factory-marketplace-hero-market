import type { SiteSchemaDocumentType } from "@/lib/site-builder/schema";
import { appendDeliverablesPackToExport } from "@/lib/site-builder/deliverables/deliverables-pack-export";
import type { AssetStrategy, DeploymentTarget, RoutingMode } from "@/lib/site-builder/refinement-schema";
import { componentFolderForPageSlug, nextRouteSegment } from "./export-route-meta";
import { HANDOFF_MANIFEST_SCHEMA_VERSION, nextSectionDescriptorsForRoute } from "./export-section-labels";
import { splitMainHtmlIntoExportSections } from "./export-section-split";
import type { ProjectExportFile } from "./types";
import { collectStaticExportArtifacts, extractMainInnerHtml, rewriteHtmlForRelativeCss } from "./static-artifacts";
import { staticHtmlFilenameForPage } from "./static-multi-page-nav";

export const HANDOFF_EXPORT_ENGINE_VERSION = "1.0.0";

function themeDirectorySlug(schema: SiteSchemaDocumentType): string {
  const t =
    (schema.metadata?.title || "site-builder-theme").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") ||
    "site-builder-theme";
  return t.slice(0, 60);
}

function firstHeroAccent(schema: SiteSchemaDocumentType): string | undefined {
  for (const page of schema.pages) {
    for (const block of page.blocks) {
      if (block.type === "hero") {
        const v = block.content?.visual as Record<string, unknown> | undefined;
        const a = v?.accent;
        if (typeof a === "string" && a.trim()) return a.trim();
      }
    }
  }
  return undefined;
}

function assetRegistrySummary(schema: SiteSchemaDocumentType): Array<{
  key: string;
  assetId: string;
  kind: string;
  originalName?: string;
}> {
  const raw = schema.metadata?.siteBuilderAssets;
  if (!raw || typeof raw !== "object") return [];
  return Object.entries(raw).map(([key, rec]) => ({
    key,
    assetId: rec.assetId,
    kind: rec.kind,
    originalName: rec.originalName,
  }));
}

function collectBundledMediaPaths(files: ProjectExportFile[]): string[] {
  return files
    .filter((f) => {
      if (f.path.endsWith("/.gitkeep")) return false;
      if (typeof f.content !== "string") return true;
      return /\.(png|jpe?g|gif|webp|svg|mp4|webm|mov|woff2?|ico)$/i.test(f.path);
    })
    .map((f) => f.path)
    .sort();
}

function manifestPathPrefix(target: DeploymentTarget, themeSlug: string): string {
  if (target === "wordpress_theme") return `wordpress-theme/${themeSlug}/`;
  return "";
}

function pageBlocksSummary(page: SiteSchemaDocumentType["pages"][number]): Array<{ order: number; type: string }> {
  return page.blocks.map((b, order) => ({ order, type: b.type }));
}

function nextSectionDescriptorsForPage(
  page: SiteSchemaDocumentType["pages"][number],
  htmlByPath: Record<string, string>,
): Array<{ componentPascal: string; componentFile: string }> {
  const fname = staticHtmlFilenameForPage(page);
  const full = htmlByPath[fname];
  if (!full) return [];
  const inner = extractMainInnerHtml(rewriteHtmlForRelativeCss(full));
  const chunks = splitMainHtmlIntoExportSections(inner);
  const folder = componentFolderForPageSlug(page.slug);
  return nextSectionDescriptorsForRoute(chunks, folder).map(({ componentPascal, componentFile }) => ({
    componentPascal,
    componentFile,
  }));
}

export function buildSiteTokensObject(
  schema: SiteSchemaDocumentType,
  ctx: { target: DeploymentTarget; routingMode: RoutingMode; assetStrategy: AssetStrategy },
  themeSlug: string,
  generatedAt: string,
): Record<string, unknown> {
  const meta = schema.metadata;
  const theme = meta?.theme;
  const accent = firstHeroAccent(schema);

  return {
    handoff: {
      schemaVersion: HANDOFF_MANIFEST_SCHEMA_VERSION,
      exportEngineVersion: HANDOFF_EXPORT_ENGINE_VERSION,
      generatedAt,
      manifest: "site.tokens",
    },
    site: {
      title: meta?.title ?? null,
      description: meta?.description ?? null,
      widget: meta?.widgetIntegration
        ? {
            attached: true,
            placement: meta.widgetIntegration.placement ?? "body_end",
            loaderConfigured: Boolean(
              meta.widgetIntegration.loaderOrigin?.trim() || process.env.NEXT_PUBLIC_SITE_URL?.trim(),
            ),
          }
        : { attached: false },
      payment: meta?.paymentIntegration?.provider === "paypal"
        ? {
            provider: "paypal",
            mode: meta.paymentIntegration.mode,
            intent: meta.paymentIntegration.intent,
            placement: meta.paymentIntegration.placement,
          }
        : { configured: false },
      import: meta?.siteImport
        ? {
            sourceDomain: (() => {
              try {
                return new URL(meta.siteImport.sourceUrl).hostname;
              } catch {
                return null;
              }
            })(),
            importedAt: meta.siteImport.importedAt,
            partialImport: meta.siteImport.partialImport ?? false,
            routeCount: meta.siteImport.detectedPageCount ?? null,
          }
        : null,
      styleMode: theme?.styleMode ?? null,
      theme: {
        backgroundMode: theme?.backgroundMode ?? null,
        gradientStart: theme?.gradientStart ?? null,
        gradientEnd: theme?.gradientEnd ?? null,
        backgroundColor: theme?.backgroundColor ?? null,
        customGradient: theme?.customGradient ?? null,
        mediaType: theme?.mediaType ?? null,
      },
      designSystem: meta?.designSystem ?? null,
      governance: meta?.governance ?? null,
      colors: {
        accentFromHero: accent ?? null,
        note: accent ? "Taken from first hero block visual.accent when present." : null,
      },
    },
    deployment: {
      target: ctx.target,
      routingMode: ctx.routingMode,
      assetStrategy: ctx.assetStrategy,
      wordpressThemeSlug: ctx.target === "wordpress_theme" ? themeSlug : null,
    },
    routes: schema.pages.map((p) => {
      const flat = p.slug === "/" ? "index" : p.slug.replaceAll("/", "").trim() || "index";
      return {
        slug: p.slug,
        staticHtml: staticHtmlFilenameForPage(p),
        nextRouteSegment: flat === "index" ? null : nextRouteSegment(flat),
      };
    }),
    assets: {
      registry: assetRegistrySummary(schema),
      strategyNote:
        ctx.assetStrategy === "remote_urls"
          ? "URLs from the builder are preserved; hosted uploads only work while the app serves them."
          : "Local bundle copies uploads into target-specific folders when files exist on the server at export time.",
    },
  };
}

export function buildSiteContentMapObject(
  files: ProjectExportFile[],
  schema: SiteSchemaDocumentType,
  ctx: { target: DeploymentTarget; routingMode: RoutingMode; assetStrategy: AssetStrategy },
  themeSlug: string,
  generatedAt: string,
): Record<string, unknown> {
  const { htmlByPath } = collectStaticExportArtifacts(schema);
  const prefix = manifestPathPrefix(ctx.target, themeSlug);

  const pages = schema.pages.map((page) => {
    const staticFile = staticHtmlFilenameForPage(page);
    const routeSlug = page.slug === "/" ? "index" : page.slug.replaceAll("/", "").trim() || "index";
    const appSegment = routeSlug === "index" ? null : nextRouteSegment(routeSlug);
    const compFolder = componentFolderForPageSlug(page.slug);

    const base: Record<string, unknown> = {
      slug: page.slug,
      blocks: pageBlocksSummary(page),
      static: { htmlFile: staticFile },
    };

    if (ctx.target === "vercel_nextjs") {
      base.next = {
        pageFile: appSegment === null ? "app/page.tsx" : `app/${appSegment}/page.tsx`,
        componentsDir: `components/site-builder-export/${compFolder}`,
        sections: nextSectionDescriptorsForPage(page, htmlByPath),
      };
    }

    if (ctx.target === "wordpress_theme") {
      const extra = staticFile !== "index.html" ? `${prefix}template-${staticFile.replace(/\.html$/i, "")}.php` : null;
      base.wordpress = {
        frontMain: `${prefix}template-parts/site-export-front-main.php`,
        nav: `${prefix}template-parts/site-export-nav.php`,
        optionalRouteTemplate: extra,
        templatePartLabels: {
          nav: "Primary navigation — URLs mirror builder slugs; update if WordPress permalinks differ.",
          frontMain: "Landing page body HTML exported from the builder (edit in place or split into blocks).",
          optionalRouteTemplate:
            extra == null
              ? null
              : "Optional full-page template for an extra builder route — assign under Page → Template or paste into a standard page.",
        },
      };
    }

    return base;
  });

  const embed =
    ctx.target === "gohighlevel_embed"
      ? {
          sectionHtml: "embed/section.html",
          fullPageHtml: "embed/full-page.html",
          styles: "embed/styles.css",
          script: "embed/script.js",
          assetsDir: "embed/assets/",
          multiPageNote: files.some((f) => f.path === "embed/MULTI_PAGE_NOTE.md") ? "embed/MULTI_PAGE_NOTE.md" : null,
        }
      : null;

  return {
    handoff: {
      schemaVersion: HANDOFF_MANIFEST_SCHEMA_VERSION,
      exportEngineVersion: HANDOFF_EXPORT_ENGINE_VERSION,
      generatedAt,
      manifest: "site.content-map",
    },
    deployment: {
      target: ctx.target,
      routingMode: ctx.routingMode,
      assetStrategy: ctx.assetStrategy,
    },
    pages,
    embed,
    bundledMediaPaths: collectBundledMediaPaths(files),
    editHints: editHintsForTarget(ctx.target, prefix),
  };
}

function editHintsForTarget(target: DeploymentTarget, wpPrefix: string): Record<string, string> {
  switch (target) {
    case "vercel_nextjs":
      return {
        copyAndSections: "`app/<route>/page.tsx` composes sections; markup chunks live under `components/site-builder-export/<route>/`.",
        styling: "`app/globals.css` (builder CSS) plus component class names from the static export.",
        assets: "`public/images`, `public/video`, `public/icons` — bundle step may add binaries when strategy is local.",
        layoutSeo: "`app/layout.tsx` for document shell and metadata.",
      };
    case "wordpress_theme":
      return {
        copyAndSections: `\`${wpPrefix}template-parts/site-export-front-main.php\` (landing body), optional \`template-*.php\` for extra routes.`,
        styling: `\`${wpPrefix}style.css\` (full builder CSS). Prefer child theme or incremental overrides in Customizer/CSS plugin if upgrading.`,
        assets: `\`${wpPrefix}assets/images\`, \`${wpPrefix}assets/video\`.`,
        navigation: `\`${wpPrefix}template-parts/site-export-nav.php\` — update if permalinks differ.`,
      };
    case "gohighlevel_embed":
      return {
        copyAndSections: "`embed/section.html` for funnel Custom HTML; `embed/full-page.html` for standalone preview.",
        styling: "`embed/styles.css` — load globally or paste critical rules in GHL.",
        assets: "`embed/assets/images`, `embed/assets/video`.",
        scripts: "`embed/script.js` — keep minimal for CSP.",
      };
    case "static":
    case "netlify_static":
    case "ipfs":
    case "custom":
    default:
      return {
        copyAndSections: "One `.html` file per route at ZIP root (e.g. `index.html`, `about.html`).",
        styling: "`styles.css`; optional `scripts.js` for light behaviors.",
        assets: "`assets/images`, `assets/video`, `assets/icons` plus `assets/README.txt`.",
        hosting: "Upload the folder to any static host; entry is `index.html`.",
      };
  }
}

/**
 * Injects / updates machine-readable manifests and ensures static targets get a README.
 * Call after `applySiteBuilderAssetBundle` so bundled media paths are listed.
 */
export function finalizeHandoffArtifacts(
  files: ProjectExportFile[],
  schema: SiteSchemaDocumentType,
  ctx: { target: DeploymentTarget; routingMode: RoutingMode; assetStrategy: AssetStrategy },
  readmeBuilder: (readmeCtx: {
    target: DeploymentTarget;
    routingMode: RoutingMode;
    assetStrategy: AssetStrategy;
  }) => string,
): void {
  const themeSlug = themeDirectorySlug(schema);
  const prefix = manifestPathPrefix(ctx.target, themeSlug);

  if (ctx.target === "static" && !files.some((f) => f.path === "README.md")) {
    files.push({
      path: "README.md",
      content: readmeBuilder({ target: "static", routingMode: ctx.routingMode, assetStrategy: ctx.assetStrategy }),
      contentType: "text/markdown",
    });
  }

  const generatedAt = new Date().toISOString();
  const tokens = buildSiteTokensObject(schema, ctx, themeSlug, generatedAt);
  const contentMap = buildSiteContentMapObject(files, schema, ctx, themeSlug, generatedAt);

  const upsert = (relativePath: string, content: string) => {
    const path = `${prefix}${relativePath}`;
    const idx = files.findIndex((f) => f.path === path);
    const entry: ProjectExportFile = { path, content, contentType: "application/json" };
    if (idx >= 0) {
      files[idx] = entry;
    } else {
      files.push(entry);
    }
  };

  upsert("site.tokens.json", `${JSON.stringify(tokens, null, 2)}\n`);
  upsert("site.content-map.json", `${JSON.stringify(contentMap, null, 2)}\n`);

  appendDeliverablesPackToExport(files, schema, { target: ctx.target, themeSlug });
}
