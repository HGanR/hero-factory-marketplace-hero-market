/**
 * Centralized AI Agency widget injection for static HTML, preview blobs, and deployment handoffs.
 * Consultant sets `metadata.widgetIntegration`; optional `metadata.advanced.customJs` remains separate.
 */

import type { SiteSchemaDocumentType } from "@/lib/site-builder/schema";

function escapeHtmlAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

function normalizeSlugForMatch(slug: string): string {
  const t = slug.trim();
  if (!t || t === "/") return "/";
  return t.startsWith("/") ? t.replace(/\/+$/, "") || "/" : `/${t.replace(/\/+$/, "")}`;
}

/** Resolve loader origin: schema override → env (build-time) → empty. */
export function resolveWidgetLoaderOrigin(schema: SiteSchemaDocumentType): string {
  const fromSchema = schema.metadata?.widgetIntegration?.loaderOrigin?.trim();
  if (fromSchema) return fromSchema.replace(/\/$/, "");
  if (typeof process !== "undefined" && process.env.NEXT_PUBLIC_SITE_URL?.trim()) {
    return process.env.NEXT_PUBLIC_SITE_URL.trim().replace(/\/$/, "");
  }
  return "";
}

export function widgetAppliesToPage(schema: SiteSchemaDocumentType, pageSlug: string): boolean {
  const w = schema.metadata?.widgetIntegration;
  if (!w?.widgetKey) return false;
  if (w.placement === "page_body_end" && w.pageSlug?.trim()) {
    return normalizeSlugForMatch(pageSlug) === normalizeSlugForMatch(w.pageSlug);
  }
  return true;
}

function buildConfigInlineScript(widgetKey: string, context: Record<string, unknown>): string {
  const payload = JSON.stringify({ widgetKey, context }).replace(/</g, "\\u003c");
  return `<script>window.TROO_AGENT_CONFIG=${payload};</script>`;
}

export function buildAgencyWidgetSnippetHtml(schema: SiteSchemaDocumentType, pageSlug: string): {
  head: string;
  bodyBeforeClose: string;
  needsLoaderOrigin: boolean;
} {
  const w = schema.metadata?.widgetIntegration;
  if (!w?.widgetKey || !widgetAppliesToPage(schema, pageSlug)) {
    return { head: "", bodyBeforeClose: "", needsLoaderOrigin: false };
  }
  const origin = resolveWidgetLoaderOrigin(schema);
  const context: Record<string, unknown> = {
    pageType: "site",
    source: "sitebuilder",
    route: pageSlug,
  };
  const config = buildConfigInlineScript(w.widgetKey, context);
  if (!origin) {
    return {
      head: w.placement === "head_script" ? config : "",
      bodyBeforeClose: [
        w.placement !== "head_script" ? config : "",
        `<!-- Hero site-builder: set metadata.widgetIntegration.loaderOrigin or NEXT_PUBLIC_SITE_URL, then add <script src="ORIGIN/widget/loader.js" async></script> -->`,
      ]
        .filter(Boolean)
        .join("\n"),
      needsLoaderOrigin: true,
    };
  }
  const loader = `<script src="${escapeHtmlAttr(`${origin}/widget/loader.js`)}" async></script>`;
  if (w.placement === "head_script") {
    return { head: `${config}\n${loader}`, bodyBeforeClose: "", needsLoaderOrigin: false };
  }
  return { head: "", bodyBeforeClose: `${config}\n${loader}`, needsLoaderOrigin: false };
}

/** Blob preview (new tab) — body-end injection only. */
export function buildWidgetEmbedForIsolatedPreviewHtml(schema: SiteSchemaDocumentType): string {
  const w = schema.metadata?.widgetIntegration;
  if (!w?.widgetKey || w.injectInDevPreviewTab === false) return "";
  const { bodyBeforeClose } = buildAgencyWidgetSnippetHtml(schema, "/");
  return bodyBeforeClose;
}

/** Next.js handoff: JSX fragment as string (injected in RootLayout body). */
export function buildNextRootLayoutWidgetFragmentTsx(schema: SiteSchemaDocumentType): string {
  const w = schema.metadata?.widgetIntegration;
  if (!w?.widgetKey) return "";
  const origin = resolveWidgetLoaderOrigin(schema);
  const cfgJs = `window.TROO_AGENT_CONFIG=${JSON.stringify({
    widgetKey: w.widgetKey,
    context: { pageType: "site", source: "sitebuilder_export" },
  })};`;
  if (!origin) {
    return `
        <script
          dangerouslySetInnerHTML={{
            __html: ${JSON.stringify(cfgJs)},
          }}
        />
        {/* Add loader: set metadata.widgetIntegration.loaderOrigin or NEXT_PUBLIC_SITE_URL at export */}`;
  }
  const src = `${origin}/widget/loader.js`;
  return `
        <script
          dangerouslySetInnerHTML={{
            __html: ${JSON.stringify(cfgJs)},
          }}
        />
        <script src={${JSON.stringify(src)}} async />`;
}

/** WordPress footer: snippet before `wp_footer()` (static PHP generated at export). */
export function buildWordPressFooterWidgetSnippet(schema: SiteSchemaDocumentType): string {
  const w = schema.metadata?.widgetIntegration;
  if (!w?.widgetKey) return "";
  const origin = resolveWidgetLoaderOrigin(schema);
  const payload = JSON.stringify({
    widgetKey: w.widgetKey,
    context: { pageType: "site", source: "wordpress_theme" },
  });
  const payloadPhp = payload.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
  const lines = [
    `<?php`,
    `// Site builder — AI Agency widget`,
    `$troo_sb_agent = json_decode( '${payloadPhp}', true );`,
    `if ( ! is_array( $troo_sb_agent ) ) { $troo_sb_agent = array(); }`,
    `?>`,
    `<script>window.TROO_AGENT_CONFIG=<?php echo wp_json_encode( $troo_sb_agent ); ?>;</script>`,
  ];
  if (origin) {
    const o = origin.replace(/'/g, "\\'");
    lines.push(`<script src="<?php echo esc_url( '${o}/widget/loader.js' ); ?>" async></script>`);
  } else {
    lines.push(`<!-- Set metadata.widgetIntegration.loaderOrigin and re-export, or enqueue loader manually. -->`);
  }
  return `${lines.join("\n")}\n`;
}
