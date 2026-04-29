/**
 * Deterministic, planner-free block reordering for explicit layout requests.
 * Does not mutate registry keys or aiSectionIds — only block order on the primary route.
 */

import type { SiteSchemaDocumentType } from "@/lib/site-builder/schema";

function getRegistryKey(block: SiteSchemaDocumentType["pages"][number]["blocks"][number]): string {
  return String((block.content as Record<string, unknown> | undefined)?.aiRegistryKey || "").trim();
}

function findIndexByRegistry(
  blocks: SiteSchemaDocumentType["pages"][number]["blocks"],
  keys: string[],
): number {
  return blocks.findIndex((b) => keys.includes(getRegistryKey(b)));
}

function findIndexByType(
  blocks: SiteSchemaDocumentType["pages"][number]["blocks"],
  types: string[],
): number {
  return blocks.findIndex((b) => types.includes(String(b.type || "")));
}

function moveBlock(
  blocks: SiteSchemaDocumentType["pages"][number]["blocks"],
  from: number,
  to: number,
): SiteSchemaDocumentType["pages"][number]["blocks"] {
  if (from < 0 || from >= blocks.length || to < 0 || to >= blocks.length || from === to) return blocks;
  const next = [...blocks];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item!);
  return next;
}

/**
 * Returns updated document if a heuristic applied; otherwise the original reference unchanged.
 */
export function applyLayoutRestructureHeuristic(
  doc: SiteSchemaDocumentType,
  instruction: string,
  selectedIds: string[],
  primaryPageIndex = 0,
): { doc: SiteSchemaDocumentType; applied: boolean; kind?: string } {
  const t = instruction.trim().toLowerCase();
  if (!t) return { doc, applied: false };

  const page = doc.pages[primaryPageIndex];
  if (!page?.blocks?.length) return { doc, applied: false };

  let blocks = [...page.blocks];
  let applied = false;
  let kind: string | undefined;

  const heroIdx = findIndexByType(blocks, ["hero"]);
  const ctaIdxByType = findIndexByType(blocks, ["call_to_action"]);
  const ctaIdx = ctaIdxByType >= 0 ? ctaIdxByType : findIndexByRegistry(blocks, ["mid_cta"]);
  const statIdx = findIndexByRegistry(blocks, ["stat_band"]);

  // "move proof/stats higher" / "proof higher"
  if (/\b(move|bring|push)\b.*\b(higher|up|earlier)\b/.test(t) && /\b(proof|stats?|metrics?|stat band)\b/.test(t)) {
    const proofIdx = statIdx >= 0 ? statIdx : findIndexByRegistry(blocks, ["social_proof", "paragraph_intro"]);
    if (proofIdx > 1) {
      blocks = moveBlock(blocks, proofIdx, Math.max(1, proofIdx - 1));
      applied = true;
      kind = "resequence_proof_up";
    }
  }

  // "move proof lower"
  if (/\b(move|bring|push)\b.*\b(lower|down|later)\b/.test(t) && /\b(proof|stats?|metrics?)\b/.test(t)) {
    const proofIdx = statIdx >= 0 ? statIdx : findIndexByRegistry(blocks, ["social_proof"]);
    if (proofIdx >= 0 && proofIdx < blocks.length - 2) {
      blocks = moveBlock(blocks, proofIdx, proofIdx + 1);
      applied = true;
      kind = "resequence_proof_down";
    }
  }

  // "cta after hero" / "put cta right after hero"
  if (
    /\b(cta|call to action)\b/.test(t) &&
    /\b(after|below|following)\b.*\b(hero|headline)\b/.test(t) &&
    ctaIdx >= 0 &&
    heroIdx >= 0
  ) {
    const targetPos = heroIdx + 1;
    if (ctaIdx !== targetPos && targetPos < blocks.length) {
      blocks = moveBlock(blocks, ctaIdx, targetPos);
      applied = true;
      kind = "resequence_cta_after_hero";
    }
  }

  // "move cta higher" (toward hero)
  if (/\b(cta|call to action)\b/.test(t) && /\b(higher|up|earlier)\b/.test(t) && ctaIdx > heroIdx + 1) {
    blocks = moveBlock(blocks, ctaIdx, ctaIdx - 1);
    applied = true;
    kind = "resequence_cta_up";
  }

  // Selected ids hint: "these sections" + reorder keywords — nudge selected blocks earlier as a group (minimal)
  if (
    selectedIds.length > 1 &&
    /\b(reorder|resequence|flow)\b/.test(t) &&
    /\b(editorial|narrative|story)\b/.test(t)
  ) {
    const indices = selectedIds
      .map((id) => blocks.findIndex((b) => String((b.content as Record<string, unknown>)?.aiSectionId || "") === id))
      .filter((i) => i >= 0)
      .sort((a, b) => a - b);
    if (indices.length > 1 && indices[0]! > 1) {
      const first = indices[0]!;
      blocks = moveBlock(blocks, first, Math.max(1, first - 1));
      applied = true;
      kind = "resequence_selection_up";
    }
  }

  if (!applied) return { doc, applied: false };

  const nextPages = doc.pages.map((p, pi) => (pi === primaryPageIndex ? { ...p, blocks } : p));
  return { doc: { ...doc, pages: nextPages }, applied: true, kind };
}
