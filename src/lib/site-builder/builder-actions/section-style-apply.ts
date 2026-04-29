import type { SiteSchemaDocumentType } from "@/lib/site-builder/schema";

function readAiSectionId(block: SiteSchemaDocumentType["pages"][number]["blocks"][number]): string {
  const c = block.content as { aiSectionId?: string } | undefined;
  return String(c?.aiSectionId || "").trim();
}

function readBlockSchemaId(block: SiteSchemaDocumentType["pages"][number]["blocks"][number]): string {
  return String((block as { id?: string }).id || "").trim();
}

function readContentSectionId(block: SiteSchemaDocumentType["pages"][number]["blocks"][number]): string {
  const c = block.content as { sectionId?: string } | undefined;
  return String(c?.sectionId || "").trim();
}

/**
 * Resolve a section target for style patches: `content.aiSectionId`, block `id`, then `content.sectionId`.
 */
export function findBlockByAiSectionId(
  doc: SiteSchemaDocumentType,
  pageSlug: string,
  sectionId: string,
): { pageIndex: number; blockIndex: number; block: SiteSchemaDocumentType["pages"][number]["blocks"][number] } | null {
  const sid = sectionId.trim();
  if (!sid) return null;
  const pi = doc.pages.findIndex((p) => p.slug === pageSlug);
  if (pi === -1) return null;
  const blocks = doc.pages[pi]!.blocks;
  const byAi = blocks.findIndex((b) => readAiSectionId(b) === sid);
  if (byAi !== -1) return { pageIndex: pi, blockIndex: byAi, block: blocks[byAi]! };
  const byId = blocks.findIndex((b) => readBlockSchemaId(b) === sid);
  if (byId !== -1) return { pageIndex: pi, blockIndex: byId, block: blocks[byId]! };
  const bySectionId = blocks.findIndex((b) => readContentSectionId(b) === sid);
  if (bySectionId !== -1) return { pageIndex: pi, blockIndex: bySectionId, block: blocks[bySectionId]! };
  return null;
}

/** Normalize named colors and hex for CSS. */
export function normalizeCssColor(raw: string): string {
  const t = raw.trim().toLowerCase();
  if (!t) return "#ffffff";
  if (t === "white") return "#ffffff";
  if (t === "black") return "#000000";
  if (/^#[0-9a-f]{3}$/i.test(t)) {
    const h = t.slice(1);
    return `#${h[0]}${h[0]}${h[1]}${h[1]}${h[2]}${h[2]}`.toLowerCase();
  }
  if (/^#[0-9a-f]{6}$/i.test(t)) return t.toLowerCase();
  return raw.trim().slice(0, 40);
}

/**
 * Apply section surface colors to `content.style` (preview reads via getBlockStyle).
 * Hero blocks also get `content.visual.background` so Troothertz hero preview shows the fill.
 */
export function applySectionBackgroundToBlock(
  block: SiteSchemaDocumentType["pages"][number]["blocks"][number],
  color: string,
): void {
  const hex = normalizeCssColor(color);
  const c = (block.content || {}) as Record<string, unknown>;
  const style = { ...((c.style as Record<string, unknown>) || {}) };
  style.backgroundColor = hex;
  c.style = style;
  if (block.type === "hero") {
    const visual = { ...((c.visual as Record<string, unknown>) || {}) };
    visual.background = { type: "color", value: hex };
    c.visual = visual;
  }
  block.content = c;
}

export function applySectionTextColorToBlock(
  block: SiteSchemaDocumentType["pages"][number]["blocks"][number],
  color: string,
): void {
  const hex = normalizeCssColor(color);
  const c = (block.content || {}) as Record<string, unknown>;
  const style = { ...((c.style as Record<string, unknown>) || {}) };
  style.textColor = hex;
  c.style = style;
  block.content = c;
}

export function applySectionAccentToBlock(
  block: SiteSchemaDocumentType["pages"][number]["blocks"][number],
  color: string,
): void {
  const hex = normalizeCssColor(color);
  const c = (block.content || {}) as Record<string, unknown>;
  const style = { ...((c.style as Record<string, unknown>) || {}) };
  style.borderColor = hex;
  c.style = style;
  if (block.type === "hero") {
    const visual = { ...((c.visual as Record<string, unknown>) || {}) };
    visual.accent = hex;
    c.visual = visual;
  }
  block.content = c;
}

export function mergeSectionStylePatch(
  block: SiteSchemaDocumentType["pages"][number]["blocks"][number],
  patch: Record<string, unknown>,
): void {
  const c = (block.content || {}) as Record<string, unknown>;
  const style = { ...((c.style as Record<string, unknown>) || {}), ...patch };
  c.style = style;
  block.content = c;
}
