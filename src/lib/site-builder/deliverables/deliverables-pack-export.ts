import type { SiteSchemaDocumentType } from "@/lib/site-builder/schema";
import {
  assembleDeliverablesFromSchema,
  deliverablesToBundledFiles,
  shouldIncludeDeliverablesInExport,
} from "@/lib/site-builder/assemble-deliverables";
import type { DeploymentTarget } from "@/lib/site-builder/refinement-schema";
import type { ProjectExportFile } from "@/lib/site-builder/project-export/types";

function pathPrefixForTarget(target: DeploymentTarget, themeSlug: string): string {
  if (target === "wordpress_theme") return `wordpress-theme/${themeSlug}/`;
  return "";
}

/**
 * Adds deliverables/ artifacts to the export ZIP when an imported-site audit exists.
 */
export function appendDeliverablesPackToExport(
  files: ProjectExportFile[],
  schema: SiteSchemaDocumentType,
  ctx: { target: DeploymentTarget; themeSlug: string },
): void {
  if (!shouldIncludeDeliverablesInExport(schema)) return;
  const pack = assembleDeliverablesFromSchema(schema);
  const bundled = deliverablesToBundledFiles(pack, schema);
  const prefix = pathPrefixForTarget(ctx.target, ctx.themeSlug);
  const base = `${prefix}deliverables/`;
  for (const { path, content } of bundled) {
    const isJson = path.endsWith(".json");
    const isMd = path.endsWith(".md");
    const isHtml = path.endsWith(".html");
    files.push({
      path: `${base}${path}`,
      content,
      contentType: isJson ? "application/json" : isMd ? "text/markdown" : isHtml ? "text/html" : "text/plain",
    });
  }
}
