import { stripSensitiveClientLifecycleForPublicExport } from "@/lib/site-builder/client-lifecycle-metadata";
import type { SiteSchemaDocumentType } from "@/lib/site-builder/schema";
import type { ProjectExportFile } from "./types";
import { injectMultiPageSiteNav } from "./static-multi-page-nav";
import { collectStaticExportArtifacts, injectScriptsJs, rewriteHtmlForRelativeCss } from "./static-artifacts";

const STUB_SCRIPT = `/* Site builder export */
document.documentElement.classList.add("site-export-ready");
`;

/**
 * Default static ZIP: index.html, styles.css, scripts.js, assets/* (relative paths).
 */
export function assembleStaticZipProject(schema: SiteSchemaDocumentType): ProjectExportFile[] {
  const safe = stripSensitiveClientLifecycleForPublicExport(schema);
  const { htmlByPath, bundledCss } = collectStaticExportArtifacts(safe);
  const out: ProjectExportFile[] = [];

  for (const [path, rawHtml] of Object.entries(htmlByPath)) {
    let html = rewriteHtmlForRelativeCss(rawHtml);
    if (schema.pages.length > 1) {
      html = injectMultiPageSiteNav(html, schema, path);
    }
    html = injectScriptsJs(html, "./scripts.js");
    out.push({ path, content: html, contentType: "text/html" });
  }

  out.push({
    path: "styles.css",
    content: bundledCss,
    contentType: "text/css",
  });

  out.push({
    path: "scripts.js",
    content: STUB_SCRIPT,
    contentType: "application/javascript",
  });

  const readmeAssets = `Place local images in assets/images, video files in assets/video, icons in assets/icons.
External URLs in your schema are unchanged. For offline hosting, download those assets and update paths.
`;

  out.push({ path: "assets/images/.gitkeep", content: "", contentType: "text/plain" });
  out.push({ path: "assets/video/.gitkeep", content: "", contentType: "text/plain" });
  out.push({ path: "assets/icons/.gitkeep", content: "", contentType: "text/plain" });
  out.push({ path: "assets/README.txt", content: readmeAssets, contentType: "text/plain" });

  return out;
}
