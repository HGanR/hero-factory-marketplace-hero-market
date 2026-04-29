import { SiteSchemaDocument } from "@/lib/site-builder/schema";

const MAX_SUMMARY_CHARS = 6000;

/**
 * Cheap, non-secret summary of a site document for widget system prompts (no full schema dump).
 */
export function buildSiteWidgetSummaryFromSchemaJson(schemaJson: string): string | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(schemaJson) as unknown;
  } catch {
    return null;
  }
  const doc = SiteSchemaDocument.safeParse(parsed);
  if (!doc.success) return null;
  const d = doc.data;
  const lines: string[] = [];

  const metaTitle = d.metadata?.title?.trim();
  const metaDesc = d.metadata?.description?.trim();
  if (metaTitle) lines.push(`Site title: ${metaTitle}`);
  if (metaDesc) lines.push(`Site description: ${metaDesc}`);

  const pages = d.pages.map((p) => p.slug).filter(Boolean);
  if (pages.length) lines.push(`Pages: ${pages.slice(0, 40).join(", ")}${pages.length > 40 ? "…" : ""}`);

  const snippets: string[] = [];
  for (const page of d.pages.slice(0, 12)) {
    for (const block of page.blocks.slice(0, 24)) {
      const c = block.content as Record<string, unknown> | undefined;
      if (!c || typeof c !== "object") continue;
      for (const key of ["title", "headline", "subtitle", "body", "text", "description", "ctaLabel"]) {
        const val = c[key];
        if (typeof val === "string" && val.trim().length > 2) {
          const t = val.trim().replace(/\s+/g, " ");
          if (t.length > 220) snippets.push(t.slice(0, 217) + "…");
          else snippets.push(t);
        }
      }
      if (snippets.length >= 24) break;
    }
    if (snippets.length >= 24) break;
  }
  if (snippets.length) {
    lines.push("Content excerpts (for tone and facts; do not invent offers not implied here):");
    lines.push(...snippets.map((s) => `- ${s}`));
  }

  const out = lines.join("\n").trim();
  if (!out) return null;
  return out.length > MAX_SUMMARY_CHARS ? `${out.slice(0, MAX_SUMMARY_CHARS)}…` : out;
}
