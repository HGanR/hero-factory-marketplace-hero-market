import { unzipSync } from "fflate";
import { SiteSchemaDocument } from "@/lib/site-builder/schema";
import { SITE_BUILDER_SCHEMA_ZIP_PATH } from "@/lib/site-builder/project-export/builder-schema-artifact";

export const EXECUTIVE_INBOX_SITE_PROJECT_MIMES = new Set([
  "application/zip",
  "application/x-zip-compressed",
  "multipart/x-zip",
]);

export const EXECUTIVE_INBOX_MAX_SITE_PROJECT_BYTES = 50 * 1024 * 1024;

export type SiteProjectZipProbe = {
  valid: boolean;
  hasBuilderSchema: boolean;
  hasNextJsMarkers: boolean;
  entryCount: number;
};

function normalizeZipPath(path: string): string {
  return path.replace(/\\/g, "/").replace(/^\/+/, "");
}

function findZipEntry(
  files: Record<string, Uint8Array>,
  leafName: string,
): Uint8Array | null {
  const target = leafName.toLowerCase();
  for (const [rawPath, data] of Object.entries(files)) {
    const parts = normalizeZipPath(rawPath).split("/");
    const leaf = parts[parts.length - 1]?.toLowerCase();
    if (leaf === target) return data;
  }
  return null;
}

export function probeSiteProjectZipBuffer(buffer: Buffer | Uint8Array): SiteProjectZipProbe {
  try {
    const files = unzipSync(buffer instanceof Buffer ? new Uint8Array(buffer) : buffer);
    const names = Object.keys(files).map(normalizeZipPath);
    const hasBuilderSchema = Boolean(findZipEntry(files, SITE_BUILDER_SCHEMA_ZIP_PATH));
    const hasPackageJson = names.some((n) => n.endsWith("/package.json") || n === "package.json");
    const hasNextConfig = names.some(
      (n) =>
        n.endsWith("/next.config.ts") ||
        n.endsWith("/next.config.js") ||
        n.endsWith("/next.config.mjs") ||
        n === "next.config.ts" ||
        n === "next.config.js" ||
        n === "next.config.mjs",
    );
    const hasAppDir = names.some((n) => n.startsWith("app/") || n.includes("/app/"));
    const hasNextJsMarkers = hasPackageJson && (hasNextConfig || hasAppDir);
    const valid = hasBuilderSchema || hasNextJsMarkers;
    return {
      valid,
      hasBuilderSchema,
      hasNextJsMarkers,
      entryCount: names.length,
    };
  } catch {
    return { valid: false, hasBuilderSchema: false, hasNextJsMarkers: false, entryCount: 0 };
  }
}

export function extractBuilderSchemaJsonFromZipBuffer(buffer: Buffer | Uint8Array): string | null {
  try {
    const files = unzipSync(buffer instanceof Buffer ? new Uint8Array(buffer) : buffer);
    const entry = findZipEntry(files, SITE_BUILDER_SCHEMA_ZIP_PATH);
    if (!entry) return null;
    const raw = new TextDecoder().decode(entry).trim();
    if (!raw) return null;
    const parsed = SiteSchemaDocument.safeParse(JSON.parse(raw));
    if (!parsed.success) return null;
    return JSON.stringify(parsed.data, null, 2);
  } catch {
    return null;
  }
}

export function isExecutiveInboxSiteProjectMime(mime: string): boolean {
  return EXECUTIVE_INBOX_SITE_PROJECT_MIMES.has(mime.toLowerCase());
}
