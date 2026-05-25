import type { SiteSchemaDocumentType } from "@/lib/site-builder/schema";
import type { ProjectExportFile } from "./types";

/** Canonical path inside deployment ZIPs for round-trip Site Builder import. */
export const SITE_BUILDER_SCHEMA_ZIP_PATH = "site.builder-schema.json";

export function embedBuilderSchemaInExport(
  files: ProjectExportFile[],
  schema: SiteSchemaDocumentType,
): void {
  const content = `${JSON.stringify(schema, null, 2)}\n`;
  const entry: ProjectExportFile = {
    path: SITE_BUILDER_SCHEMA_ZIP_PATH,
    content,
    contentType: "application/json",
  };
  const idx = files.findIndex((f) => f.path === SITE_BUILDER_SCHEMA_ZIP_PATH);
  if (idx >= 0) files[idx] = entry;
  else files.push(entry);
}
