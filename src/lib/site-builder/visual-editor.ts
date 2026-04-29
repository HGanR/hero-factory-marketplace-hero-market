import { blockTemplate, type BlockTemplateKey } from "@/lib/site-builder/builder-actions/block-templates";

type Block = Record<string, any>;
type Doc = { pages?: Array<{ slug?: string; blocks?: Block[] }>; metadata?: Record<string, any> };

export type VisualSectionItem = {
  id: string;
  index: number;
  type: string;
  label: string;
  hidden: boolean;
};

export type SectionStylePreset = "minimal" | "corporate" | "web3" | "bold";

export function parseVisualDoc(schemaText: string): Doc {
  try {
    const parsed = JSON.parse(schemaText) as Doc;
    if (!Array.isArray(parsed.pages)) parsed.pages = [];
    if (!parsed.pages[0]) parsed.pages[0] = { slug: "/", blocks: [] };
    if (!Array.isArray(parsed.pages[0]!.blocks)) parsed.pages[0]!.blocks = [];
    if (!parsed.metadata || typeof parsed.metadata !== "object") parsed.metadata = {};
    return parsed;
  } catch {
    return { pages: [{ slug: "/", blocks: [] }], metadata: {} };
  }
}

function sectionIdFor(block: Block, index: number): string {
  const raw = String(block?.content?.aiSectionId || "").trim();
  return raw || `idx-${index}`;
}

function sectionLabelFor(block: Block, fallbackIndex: number): string {
  const custom = String(block?.content?.sectionLabel || "").trim();
  if (custom) return custom;
  const title = String(block?.content?.title || block?.content?.text || block?.content?.label || "").trim();
  if (title) return title;
  return `${String(block?.type || "section").replace(/_/g, " ")} ${fallbackIndex + 1}`;
}

export function getVisualSections(schemaText: string): VisualSectionItem[] {
  const doc = parseVisualDoc(schemaText);
  const blocks = doc.pages?.[0]?.blocks ?? [];
  return blocks.map((block, index) => ({
    id: sectionIdFor(block, index),
    index,
    type: String(block?.type || "section"),
    label: sectionLabelFor(block, index),
    hidden: Boolean(block?.content?.style?.display === "none" || block?.content?.responsive?.mobile?.hidden),
  }));
}

export function mutateVisualSchema(schemaText: string, mutate: (doc: Doc) => void): string {
  const doc = parseVisualDoc(schemaText);
  mutate(doc);
  return JSON.stringify(doc, null, 2);
}

export function updateSectionById(doc: Doc, sectionId: string, updater: (block: Block) => void): boolean {
  const blocks = doc.pages?.[0]?.blocks ?? [];
  const index = blocks.findIndex((block, i) => sectionIdFor(block, i) === sectionId);
  if (index < 0) return false;
  const block = blocks[index]!;
  if (!block.content || typeof block.content !== "object") block.content = {};
  updater(block);
  return true;
}

export function moveSectionById(doc: Doc, sectionId: string, direction: -1 | 1): void {
  const blocks = doc.pages?.[0]?.blocks ?? [];
  const index = blocks.findIndex((block, i) => sectionIdFor(block, i) === sectionId);
  if (index < 0) return;
  const target = index + direction;
  if (target < 0 || target >= blocks.length) return;
  const current = blocks[index];
  blocks[index] = blocks[target];
  blocks[target] = current;
}

export function removeSectionById(doc: Doc, sectionId: string): void {
  const blocks = doc.pages?.[0]?.blocks ?? [];
  const index = blocks.findIndex((block, i) => sectionIdFor(block, i) === sectionId);
  if (index >= 0) blocks.splice(index, 1);
}

export function duplicateSectionById(doc: Doc, sectionId: string): string | null {
  const blocks = doc.pages?.[0]?.blocks ?? [];
  const index = blocks.findIndex((block, i) => sectionIdFor(block, i) === sectionId);
  if (index < 0) return null;
  const clone = structuredClone(blocks[index]);
  if (!clone.content || typeof clone.content !== "object") clone.content = {};
  const id = `dup-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  clone.content.aiSectionId = id;
  clone.content.sectionLabel = `${String(clone.content.sectionLabel || "Copy")} copy`;
  blocks.splice(index + 1, 0, clone);
  return id;
}

export function reorderSectionByDropTarget(doc: Doc, sourceSectionId: string, targetSectionId: string): void {
  const blocks = doc.pages?.[0]?.blocks ?? [];
  const sourceIndex = blocks.findIndex((block, i) => sectionIdFor(block, i) === sourceSectionId);
  const targetIndex = blocks.findIndex((block, i) => sectionIdFor(block, i) === targetSectionId);
  if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return;
  const [moved] = blocks.splice(sourceIndex, 1);
  const insertAt = sourceIndex < targetIndex ? targetIndex - 1 : targetIndex;
  blocks.splice(insertAt, 0, moved);
}

export function reorderSectionBySnapDrop(
  doc: Doc,
  sourceSectionId: string,
  targetSectionId: string,
  position: "before" | "after",
): void {
  const blocks = doc.pages?.[0]?.blocks ?? [];
  const sourceIndex = blocks.findIndex((block, i) => sectionIdFor(block, i) === sourceSectionId);
  const targetIndex = blocks.findIndex((block, i) => sectionIdFor(block, i) === targetSectionId);
  if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return;
  const [moved] = blocks.splice(sourceIndex, 1);
  const adjustedTarget = sourceIndex < targetIndex ? targetIndex - 1 : targetIndex;
  const insertAt = position === "after" ? adjustedTarget + 1 : adjustedTarget;
  blocks.splice(Math.max(0, Math.min(blocks.length, insertAt)), 0, moved);
}

export function replaceFirstTextInSection(doc: Doc, sectionId: string, previousText: string, nextText: string): boolean {
  let replaced = false;
  return updateSectionById(doc, sectionId, (block) => {
    function walk(node: unknown): unknown {
      if (replaced) return node;
      if (typeof node === "string") {
        if (node.trim() === previousText.trim()) {
          replaced = true;
          return nextText;
        }
        return node;
      }
      if (Array.isArray(node)) return node.map((item) => walk(item));
      if (node && typeof node === "object") {
        const out: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
          out[key] = walk(value);
        }
        return out;
      }
      return node;
    }
    block.content = walk(block.content);
  });
}

export const VISUAL_COMPONENT_LIBRARY: Array<{ category: string; label: string; templateKey: BlockTemplateKey }> = [
  { category: "Hero", label: "Hero", templateKey: "hero" },
  { category: "Services", label: "Services list", templateKey: "section" },
  { category: "Pricing", label: "Pricing CTA", templateKey: "call_to_action" },
  { category: "FAQ", label: "FAQ section", templateKey: "section" },
  { category: "Testimonials", label: "Testimonials section", templateKey: "section" },
  { category: "CTA", label: "Call to action", templateKey: "call_to_action" },
  { category: "Contact / Form", label: "Contact block", templateKey: "section" },
];

export function createVisualLibraryBlock(templateKey: BlockTemplateKey, aiRegistryKey: string): Block {
  return blockTemplate(templateKey, { aiRegistryKey });
}

export function applySectionStylePreset(doc: Doc, sectionId: string, preset: SectionStylePreset): boolean {
  return updateSectionById(doc, sectionId, (block) => {
    block.content.style = block.content.style || {};
    block.content.visual = block.content.visual || {};
    const style = block.content.style;
    const visual = block.content.visual;
    if (preset === "minimal") {
      style.backgroundColor = "#0b1120";
      style.textColor = "#e2e8f0";
      style.padding = "40px 24px";
      style.borderRadius = 10;
      visual.accent = "#94a3b8";
    } else if (preset === "corporate") {
      style.backgroundColor = "#0f172a";
      style.textColor = "#dbeafe";
      style.padding = "44px 26px";
      style.borderRadius = 12;
      visual.accent = "#60a5fa";
    } else if (preset === "web3") {
      style.backgroundColor = "#111827";
      style.textColor = "#cffafe";
      style.padding = "48px 28px";
      style.borderRadius = 14;
      visual.accent = "#22d3ee";
    } else {
      style.backgroundColor = "#1e1b4b";
      style.textColor = "#f5d0fe";
      style.padding = "52px 28px";
      style.borderRadius = 18;
      visual.accent = "#f59e0b";
    }
  });
}

export function applyThemePresetTokens(doc: Doc, preset: SectionStylePreset): void {
  doc.metadata = doc.metadata || {};
  doc.metadata.theme = doc.metadata.theme || {};
  doc.metadata.theme.stylePreset = preset;
  doc.metadata.theme.tokens = {
    ...(doc.metadata.theme.tokens || {}),
    sectionPreset: preset,
    rhythmY: preset === "minimal" ? 20 : preset === "corporate" ? 24 : preset === "web3" ? 28 : 32,
  };
}

export function computeSectionCritiqueScore(block: Block): number {
  const c = block?.content || {};
  let score = 100;
  const hasTitle = String(c.title || c.text || "").trim().length > 0;
  const hasBody = String(c.body || c.subtitle || "").trim().length > 0;
  const hasCta = String(c.label || "").trim().length > 0 && String(c.href || "").trim().length > 0;
  if (!hasTitle) score -= 28;
  if (!hasBody) score -= 24;
  if (!hasCta && ["hero", "call_to_action", "section"].includes(String(block?.type || ""))) score -= 18;
  if (!c?.style?.padding) score -= 8;
  return Math.max(0, Math.min(100, score));
}

export function critiqueBadgeForScore(score: number): "strong" | "needs_improvement" {
  return score >= 70 ? "strong" : "needs_improvement";
}

export function suggestMissingSections(schemaText: string): string[] {
  const sections = getVisualSections(schemaText).map((s) => s.type.toLowerCase());
  const missing: string[] = [];
  if (!sections.includes("testimonials")) missing.push("Add testimonials?");
  if (!sections.includes("call_to_action")) missing.push("Improve CTA?");
  if (!sections.includes("list")) missing.push("Add services list?");
  if (!sections.includes("section")) missing.push("Add FAQ?");
  return missing.slice(0, 2);
}
