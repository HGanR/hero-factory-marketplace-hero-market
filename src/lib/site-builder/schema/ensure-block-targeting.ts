/**
 * Ensures every site block has stable aiSectionId + aiRegistryKey for preview targeting and regeneration.
 * Preserves existing values when present.
 */

import { SiteSchemaDocument, type SiteSchemaDocumentType } from "@/lib/site-builder/schema";

function newAiSectionId(): string {
  return `ai-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Default registry keys by block type — must exist in block-registry or be safe fallbacks for preview/refine. */
const BLOCK_TYPE_TO_REGISTRY_KEY: Record<string, string> = {
  hero: "hero_primary",
  text: "paragraph_intro",
  section: "paragraph_intro",
  heading: "paragraph_intro",
  paragraph: "paragraph_intro",
  image: "image_spotlight",
  header_image: "image_spotlight",
  button: "mid_cta",
  link: "mid_cta",
  big_link: "mid_cta",
  internal_big_link: "mid_cta",
  call_to_action: "mid_cta",
  footer: "footer_standard",
  divider: "paragraph_intro",
  list: "paragraph_intro",
  image_grid: "paragraph_intro",
  socials: "paragraph_intro",
  avatar: "paragraph_intro",
  audio: "paragraph_intro",
  file: "paragraph_intro",
  video: "image_spotlight",
  visual_break: "visual_break_gradient",
  stat_band: "stat_band",
};

function defaultRegistryKeyForBlockType(type: string): string {
  return BLOCK_TYPE_TO_REGISTRY_KEY[type] ?? "paragraph_intro";
}

function ensureContentRecord(block: SiteSchemaDocumentType["pages"][number]["blocks"][number]): Record<string, unknown> {
  const cur = block.content;
  if (cur && typeof cur === "object" && !Array.isArray(cur)) {
    return { ...(cur as Record<string, unknown>) };
  }
  return {};
}

/**
 * Mutates `block` in place to add missing targeting fields.
 */
export function ensureBlockTargetingInPlace(
  block: SiteSchemaDocumentType["pages"][number]["blocks"][number],
): SiteSchemaDocumentType["pages"][number]["blocks"][number] {
  const type = String(block.type || "paragraph");
  const content = ensureContentRecord(block);
  const existingId = String(content.aiSectionId || "").trim();
  if (!existingId) {
    content.aiSectionId = newAiSectionId();
  }
  const existingRk = String(content.aiRegistryKey || "").trim();
  if (!existingRk) {
    content.aiRegistryKey = defaultRegistryKeyForBlockType(type);
  }
  block.content = content;
  return block;
}

export function normalizeSiteDocumentBlockTargeting(doc: SiteSchemaDocumentType): SiteSchemaDocumentType {
  for (const page of doc.pages) {
    for (let i = 0; i < page.blocks.length; i++) {
      ensureBlockTargetingInPlace(page.blocks[i]!);
    }
  }
  return doc;
}

/**
 * Parse → normalize targeting → re-serialize. Returns original string if JSON or schema invalid.
 */
export function normalizeSchemaJsonStringForTargeting(schemaJson: string, pretty = true): string {
  let raw: unknown;
  try {
    raw = JSON.parse(schemaJson);
  } catch {
    return schemaJson;
  }
  const parsed = SiteSchemaDocument.safeParse(raw);
  if (!parsed.success) {
    return schemaJson;
  }
  normalizeSiteDocumentBlockTargeting(parsed.data);
  const next = SiteSchemaDocument.parse(parsed.data);
  return pretty ? JSON.stringify(next, null, 2) : JSON.stringify(next);
}
