"use client";

import { unzipSync } from "fflate";
import { SiteSchemaDocument } from "@/lib/site-builder/schema";
import { SITE_BUILDER_SCHEMA_ZIP_PATH } from "@/lib/site-builder/project-export/builder-schema-artifact";
import { MAANIA_SITE_BUILDER_IMPORT_PARAM } from "@/lib/maania/open-in-builder";
import { persistPendingBuilderImport } from "@/lib/maania/maania-demo-storage";

export const EXECUTIVE_INBOX_SITE_PROJECT_IMPORT_PARAM = "inboxSiteProjectImport";

export type ExecutiveInboxDisplayAttachment = {
  id: string;
  kind: "file" | "audio" | "site_project";
  filename: string;
  mimeType: string;
  sizeBytes: number;
  url: string;
  projectType?: "vercel_nextjs";
};

export function isExecutiveInboxSiteProjectAttachment(a: ExecutiveInboxDisplayAttachment): boolean {
  if (a.kind === "site_project") return true;
  const mime = a.mimeType.toLowerCase();
  const name = a.filename.toLowerCase();
  return mime.includes("zip") || name.endsWith(".zip");
}

function findSchemaEntry(files: Record<string, Uint8Array>): Uint8Array | null {
  const target = SITE_BUILDER_SCHEMA_ZIP_PATH.toLowerCase();
  for (const [rawPath, data] of Object.entries(files)) {
    const leaf = rawPath.replace(/\\/g, "/").split("/").pop()?.toLowerCase();
    if (leaf === target) return data;
  }
  return null;
}

export async function extractBuilderSchemaFromProjectZipUrl(url: string): Promise<string | null> {
  const res = await fetch(url, { credentials: "omit", cache: "no-store" });
  if (!res.ok) return null;
  const buf = new Uint8Array(await res.arrayBuffer());
  const files = unzipSync(buf);
  const entry = findSchemaEntry(files);
  if (!entry) return null;
  const raw = new TextDecoder().decode(entry).trim();
  if (!raw) return null;
  const parsed = SiteSchemaDocument.safeParse(JSON.parse(raw));
  if (!parsed.success) return null;
  return JSON.stringify(parsed.data, null, 2);
}

export async function openExecutiveInboxSiteProjectInBuilder(attachment: ExecutiveInboxDisplayAttachment): Promise<{
  ok: boolean;
  error?: string;
}> {
  if (typeof window === "undefined") return { ok: false, error: "Browser only" };
  try {
    const schemaJson = await extractBuilderSchemaFromProjectZipUrl(attachment.url);
    if (!schemaJson) {
      return {
        ok: false,
        error:
          "This ZIP has no site.builder-schema.json. Download the project and edit locally, or re-export from Site Builder (Vercel / Next.js) to enable in-browser editing.",
      };
    }
    const schema = SiteSchemaDocument.parse(JSON.parse(schemaJson));
    persistPendingBuilderImport(schema);
    const url = `/site-builder?${MAANIA_SITE_BUILDER_IMPORT_PARAM}=1&${EXECUTIVE_INBOX_SITE_PROJECT_IMPORT_PARAM}=1`;
    window.open(url, "_blank", "noopener,noreferrer");
    return { ok: true };
  } catch {
    return { ok: false, error: "Could not read the website project ZIP." };
  }
}

export function downloadExecutiveInboxSiteProject(attachment: ExecutiveInboxDisplayAttachment): void {
  if (typeof document === "undefined") return;
  const a = document.createElement("a");
  a.href = attachment.url;
  a.download = attachment.filename.endsWith(".zip") ? attachment.filename : `${attachment.filename}.zip`;
  a.rel = "noopener noreferrer";
  a.target = "_blank";
  document.body.appendChild(a);
  a.click();
  a.remove();
}
