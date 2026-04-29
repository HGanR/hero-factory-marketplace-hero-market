import type { SiteSchemaDocumentType } from "@/lib/site-builder/schema";

/** Match static-generator slug → filename (e.g. index.html, about.html). */
export function staticHtmlFilenameForPage(page: SiteSchemaDocumentType["pages"][number]): string {
  const slug = page.slug === "/" ? "index" : page.slug.replaceAll("/", "").trim() || "index";
  return `${slug}.html`;
}

function navLinkLabel(page: SiteSchemaDocumentType["pages"][number]): string {
  if (page.slug === "/" || page.slug === "") return "Home";
  const tail = page.slug.replace(/^\//, "").split("/").filter(Boolean).pop() || "Page";
  const spaced = tail.replace(/[-_]+/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** Same-directory static export: all HTML files live at ZIP root. */
function relativeHref(_fromFile: string, toFile: string): string {
  const name = toFile.replace(/^.*\//, "");
  return `./${name}`;
}

/** Inserts a compact nav bar as the first child inside `<main class="container">`. */
export function injectMultiPageSiteNav(
  html: string,
  schema: SiteSchemaDocumentType,
  currentHtmlPath: string,
): string {
  if (schema.pages.length < 2) return html;

  const links = schema.pages.map((p) => {
    const file = staticHtmlFilenameForPage(p);
    const href = relativeHref(currentHtmlPath, file);
    const label = navLinkLabel(p);
    const isCurrent = file === currentHtmlPath;
    return `<a href="${href}"${isCurrent ? ' aria-current="page"' : ""}>${escapeNavText(label)}</a>`;
  });

  const nav = `<nav class="site-export-nav" aria-label="Site pages" style="display:flex;flex-wrap:wrap;gap:10px 16px;padding:12px 0;margin-bottom:8px;border-bottom:1px solid rgba(148,163,184,0.25);font-size:0.875rem">
${links.map((l) => `    ${l}`).join("\n")}
  </nav>`;

  return html.replace(/<main([^>]*class="[^"]*container[^"]*"[^>]*)>/i, `<main$1>\n${nav}\n`);
}

function escapeNavText(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
}
