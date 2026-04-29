import type { SiteSchemaDocumentType } from "@/lib/site-builder/schema";
import {
  buildAgencyWidgetSnippetHtml,
  buildWordPressFooterWidgetSnippet,
} from "@/lib/site-builder/site-builder-widget-embed";
import type { AssetStrategy, DeploymentTarget, RoutingMode } from "@/lib/site-builder/refinement-schema";
import { assembleStaticZipProject } from "./assemble-static";
import { buildDeploymentReadme, type ReadmeContext } from "./deployment-readme";
import { buildNextHandoffExport } from "./next-handoff-export";
import type { ProjectExportFile } from "./types";
import {
  collectStaticExportArtifacts,
  extractMainInnerHtml,
  injectScriptsJs,
  rewriteHtmlForRelativeCss,
} from "./static-artifacts";
import { staticHtmlFilenameForPage } from "./static-multi-page-nav";

const STUB_SCRIPT = `/**
 * Site builder embed — hook lightweight behavior here (analytics, accordions, etc.).
 */
(function () {
  document.documentElement.classList.add("site-export-ready");
})();
`;

function wpPageLabel(page: SiteSchemaDocumentType["pages"][number]): string {
  if (page.slug === "/" || page.slug === "") return "Home";
  const tail = page.slug.replace(/^\//, "").split("/").filter(Boolean).pop() || "Page";
  const spaced = tail.replace(/[-_]+/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function wpHomeUrlPathLiteral(page: SiteSchemaDocumentType["pages"][number]): string {
  if (page.slug === "/" || page.slug === "") return "/";
  const p = page.slug.startsWith("/") ? page.slug : `/${page.slug}`;
  return p.replace(/'/g, "\\'");
}

function buildWordPressNavTemplate(schema: SiteSchemaDocumentType): string {
  if (schema.pages.length < 2) {
    return `<?php
/**
 * Nav placeholder — add markup when you publish more WordPress pages.
 *
 * @package Site_Builder_Export
 */
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
`;
  }
  const links = schema.pages
    .map((p) => {
      const pathLit = wpHomeUrlPathLiteral(p);
      const label = wpPageLabel(p).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
      return `  <a href="<?php echo esc_url( home_url( '${pathLit}' ) ); ?>"><?php echo esc_html( '${label}' ); ?></a>`;
    })
    .join("\n");

  return `<?php
/**
 * Primary nav — paths mirror the site builder export. Update if permalinks change.
 *
 * @package Site_Builder_Export
 */
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?>
<nav class="site-export-nav" aria-label="<?php esc_attr_e( 'Site pages', 'site-builder-export' ); ?>" style="display:flex;flex-wrap:wrap;gap:10px 16px;padding:12px 0;margin-bottom:8px;border-bottom:1px solid rgba(148,163,184,0.25);font-size:0.875rem">
${links}
</nav>
`;
}

function ctx(target: DeploymentTarget, routing: RoutingMode, assets: AssetStrategy): ReadmeContext {
  return { target, routingMode: routing, assetStrategy: assets };
}

function sanitizeThemeSlug(schema: SiteSchemaDocumentType): string {
  const t = (schema.metadata?.title || "site-builder-theme").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "site-builder-theme";
  return t.slice(0, 60);
}

function buildPlainStaticWithReadme(schema: SiteSchemaDocumentType, readme: string): ProjectExportFile[] {
  const files = assembleStaticZipProject(schema);
  files.push({ path: "README.md", content: readme, contentType: "text/markdown" });
  return files;
}

export function buildIpfsExport(schema: SiteSchemaDocumentType, routing: RoutingMode, assets: AssetStrategy): ProjectExportFile[] {
  return buildPlainStaticWithReadme(schema, buildDeploymentReadme(ctx("ipfs", routing, assets), schema));
}

export function buildNetlifyExport(schema: SiteSchemaDocumentType, routing: RoutingMode, assets: AssetStrategy): ProjectExportFile[] {
  const files = assembleStaticZipProject(schema);
  files.push({
    path: "netlify.toml",
    content: `[build]
  publish = "."
`,
    contentType: "text/plain",
  });
  files.push({
    path: "README.md",
    content: buildDeploymentReadme(ctx("netlify_static", routing, assets), schema),
    contentType: "text/markdown",
  });
  return files;
}

export function buildVercelNextExport(schema: SiteSchemaDocumentType, routing: RoutingMode, assets: AssetStrategy): ProjectExportFile[] {
  const { htmlByPath, bundledCss } = collectStaticExportArtifacts(schema);
  return buildNextHandoffExport({ schema, htmlByPath, bundledCss, routing, assets });
}

export function buildWordPressThemeExport(schema: SiteSchemaDocumentType, routing: RoutingMode, assets: AssetStrategy): ProjectExportFile[] {
  const slug = sanitizeThemeSlug(schema);
  const prefix = `wordpress-theme/${slug}`;
  const { htmlByPath, bundledCss } = collectStaticExportArtifacts(schema);
  const indexFull = htmlByPath["index.html"] || Object.values(htmlByPath)[0] || "";
  const inner = extractMainInnerHtml(indexFull);

  const styleCss = `/*
Theme Name: ${schema.metadata?.title || "Site Builder Export"}
Description: Handoff theme exported from Hero site builder (not a plugin).
Version: 1.0.0
Text Domain: site-builder-export
*/

${bundledCss}
`;

  const functionsPhp = `<?php
/**
 * Theme bootstrap — enqueue styles, theme supports.
 *
 * @package Site_Builder_Export
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'SITE_BUILDER_EXPORT_VERSION', '1.0.0' );

add_action( 'after_setup_theme', function () {
	add_theme_support( 'title-tag' );
	add_theme_support( 'post-thumbnails' );
} );

add_action( 'wp_enqueue_scripts', function () {
	wp_enqueue_style(
		'site-builder-export',
		get_stylesheet_uri(),
		array(),
		SITE_BUILDER_EXPORT_VERSION
	);
} );
`;

  const headerPhp = `<!DOCTYPE html>
<html <?php language_attributes(); ?>>
<head>
	<meta charset="<?php bloginfo( 'charset' ); ?>" />
	<meta name="viewport" content="width=device-width, initial-scale=1" />
	<?php wp_head(); ?>
</head>
<body <?php body_class(); ?>>
`;

  const wpWidget = buildWordPressFooterWidgetSnippet(schema);
  const footerPhp = `${wpWidget}
<?php wp_footer(); ?>
</body>
</html>
`;

  const navPart = buildWordPressNavTemplate(schema);

  const frontMainPart = `<?php
/**
 * Exported landing markup — edit in place or split into blocks.
 *
 * @package Site_Builder_Export
 */
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?>
<main class="site-builder-export container">
${inner}
</main>
`;

  const frontPagePhp = `<?php
/**
 * Front page — set “A static page” in Settings → Reading and pick your front page,
 * or leave defaults so this template renders the site root.
 *
 * @package Site_Builder_Export
 */

get_header();
get_template_part( 'template-parts/site-export', 'nav' );
get_template_part( 'template-parts/site-export', 'front-main' );
get_footer();
`;

  const indexPhp = `<?php
/**
 * Blog index — exported landing content is in front-page.php / template-parts.
 *
 * @package Site_Builder_Export
 */

get_header();
get_template_part( 'template-parts/site-export', 'nav' );
?>
<main class="site-builder-export container">
	<p><?php esc_html_e( 'Posts will appear here. Your exported landing page is wired through front-page.php.', 'site-builder-export' ); ?></p>
</main>
<?php
get_footer();
`;

  const pagePhp = `<?php
/**
 * Default page template for WordPress pages you create in the admin.
 *
 * @package Site_Builder_Export
 */

get_header();
get_template_part( 'template-parts/site-export', 'nav' );
while ( have_posts() ) {
	the_post();
	?>
<article <?php post_class( 'site-builder-export container' ); ?>>
	<?php the_content(); ?>
</article>
	<?php
}
get_footer();
`;

  const files: ProjectExportFile[] = [
    { path: `${prefix}/style.css`, content: styleCss, contentType: "text/css" },
    { path: `${prefix}/functions.php`, content: functionsPhp, contentType: "application/x-php" },
    { path: `${prefix}/header.php`, content: headerPhp, contentType: "application/x-php" },
    { path: `${prefix}/footer.php`, content: footerPhp, contentType: "application/x-php" },
    { path: `${prefix}/front-page.php`, content: frontPagePhp, contentType: "application/x-php" },
    { path: `${prefix}/index.php`, content: indexPhp, contentType: "application/x-php" },
    { path: `${prefix}/page.php`, content: pagePhp, contentType: "application/x-php" },
    { path: `${prefix}/template-parts/site-export-nav.php`, content: navPart, contentType: "application/x-php" },
    { path: `${prefix}/template-parts/site-export-front-main.php`, content: frontMainPart, contentType: "application/x-php" },
    { path: `${prefix}/assets/images/.gitkeep`, content: "", contentType: "text/plain" },
    { path: `${prefix}/assets/video/.gitkeep`, content: "", contentType: "text/plain" },
    { path: `${prefix}/README.md`, content: buildDeploymentReadme(ctx("wordpress_theme", routing, assets), schema), contentType: "text/markdown" },
  ];

  const pagesToTemplates = routing === "multi_page" ? schema.pages : schema.pages.slice(0, 1);
  const seen = new Set<string>();
  for (const page of pagesToTemplates) {
    const fname = staticHtmlFilenameForPage(page);
    if (fname === "index.html") continue;
    const html = htmlByPath[fname];
    if (!html) continue;
    const base = fname.replace(/\.html$/i, "");
    if (seen.has(base)) continue;
    seen.add(base);
    const body = extractMainInnerHtml(html);
    const tpl = `<?php
/**
 * Optional page template: ${base}
 * Assign in the Page editor under Template, or copy markup into a standard page.
 *
 * @package Site_Builder_Export
 */

get_header();
get_template_part( 'template-parts/site-export', 'nav' );
?>
<main class="site-builder-export container">
${body}
</main>
<?php
get_footer();
`;
    files.push({
      path: `${prefix}/template-${base}.php`,
      content: tpl,
      contentType: "application/x-php",
    });
  }

  return files;
}

export function buildGhlEmbedExport(schema: SiteSchemaDocumentType, routing: RoutingMode, assets: AssetStrategy): ProjectExportFile[] {
  const { htmlByPath, bundledCss } = collectStaticExportArtifacts(schema);
  const indexFull = htmlByPath["index.html"] || Object.values(htmlByPath)[0] || "";
  const inner = extractMainInnerHtml(indexFull);

  const sectionHtml = `<!--
  GoHighLevel / funnel embed — paste this block inside a Custom HTML element.
  Host embed/styles.css and embed/script.js on your CDN or GHL asset storage; update paths below if needed.
-->
<article id="site-builder-embed-root" class="site-builder-embed" data-sb-export="section">
  ${inner.split("\n").join("\n  ")}
</article>
`;

  const ghlWidgetBits = buildAgencyWidgetSnippetHtml(schema, "/");
  const ghlWidget =
    schema.metadata?.widgetIntegration?.widgetKey && schema.metadata.widgetIntegration.placement !== "head_script"
      ? ghlWidgetBits.bodyBeforeClose
      : "";
  const fullPage = injectScriptsJs(
    `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${schema.metadata?.title ? escapeXmlAttr(schema.metadata.title) : "Embed"}</title>
    <link rel="stylesheet" href="./styles.css" />
  </head>
  <body>
    ${sectionHtml.trim()}
    ${ghlWidget}
  </body>
</html>
`,
    "./script.js",
  );

  const embedCss = `/**
 * Site builder embed — scoped under .site-builder-embed where possible.
 * Safe to namespace further (e.g. .ghl-sb-root .site-builder-embed) if your page has style clashes.
 */

${bundledCss}
`;

  const files: ProjectExportFile[] = [
    { path: "embed/section.html", content: sectionHtml, contentType: "text/html" },
    { path: "embed/full-page.html", content: fullPage, contentType: "text/html" },
    { path: "embed/styles.css", content: embedCss, contentType: "text/css" },
    { path: "embed/script.js", content: STUB_SCRIPT, contentType: "application/javascript" },
    { path: "embed/assets/images/.gitkeep", content: "", contentType: "text/plain" },
    { path: "embed/assets/video/.gitkeep", content: "", contentType: "text/plain" },
    {
      path: "README.md",
      content: buildDeploymentReadme(ctx("gohighlevel_embed", routing, assets), schema),
      contentType: "text/markdown",
    },
  ];

  if (routing === "multi_page" && Object.keys(htmlByPath).length > 1) {
    const note = `# Additional static pages\n\nThis export is **section-oriented**. Extra routes from the builder live in the static ZIP target only; for GHL, duplicate \`section.html\` per funnel step or link out to full HTML pages you host separately.\n`;
    files.push({ path: "embed/MULTI_PAGE_NOTE.md", content: note, contentType: "text/markdown" });
  }

  return files;
}

function escapeXmlAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

export function buildCustomFallbackExport(schema: SiteSchemaDocumentType, routing: RoutingMode, assets: AssetStrategy): ProjectExportFile[] {
  return buildPlainStaticWithReadme(schema, buildDeploymentReadme(ctx("custom", routing, assets), schema));
}
