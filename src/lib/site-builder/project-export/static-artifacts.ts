import type { SiteSchemaDocumentType } from "@/lib/site-builder/schema";
import { generateStaticBundle } from "@/lib/site-builder/static-generator";

export type StaticExportArtifacts = {
  /** Full HTML documents keyed by bundle path (e.g. index.html). */
  htmlByPath: Record<string, string>;
  bundledCss: string;
};

export function collectStaticExportArtifacts(schema: SiteSchemaDocumentType): StaticExportArtifacts {
  const { files } = generateStaticBundle(schema);
  let bundledCss = "";
  const htmlByPath: Record<string, string> = {};
  for (const f of files) {
    if (f.path === "assets/site.css") bundledCss = f.content;
    else if (f.path.endsWith(".html")) htmlByPath[f.path] = f.content;
  }
  return { htmlByPath, bundledCss };
}

export function rewriteHtmlForRelativeCss(html: string): string {
  return html.replace(/href="\/assets\/site\.css"/g, 'href="./styles.css"');
}

export function injectScriptsJs(html: string, scriptSrc: string): string {
  if (new RegExp(`<script[^>]+src=["']${scriptSrc.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["']`, "i").test(html)) {
    return html;
  }
  return html.replace(/<\/body>/i, `  <script src="${scriptSrc}" defer></script>\n  </body>`);
}

export function extractMainInnerHtml(fullHtml: string): string {
  const m = fullHtml.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
  return m ? m[1]!.trim() : "";
}

export function extractHeadInnerHtml(fullHtml: string): string {
  const m = fullHtml.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
  return m ? m[1]!.trim() : "";
}
