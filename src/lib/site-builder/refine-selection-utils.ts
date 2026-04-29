/**
 * Refine / on-canvas multi-section selection helpers (aiSectionId contract).
 */

const MAX_REFINE_SECTIONS = 3;

export function normalizeRefineSectionIds(ids: readonly string[], max: number = MAX_REFINE_SECTIONS): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of ids) {
    const id = String(raw || "").trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
    if (out.length >= max) break;
  }
  return out;
}

export function parseAiSectionIdsFromSchemaJson(schemaText: string): string[] {
  try {
    const doc = JSON.parse(schemaText) as {
      pages?: Array<{ blocks?: Array<{ content?: { aiSectionId?: string } }> }>;
    };
    const out: string[] = [];
    for (const p of doc.pages || []) {
      for (const b of p.blocks || []) {
        const id = String(b?.content?.aiSectionId || "").trim();
        if (id) out.push(id);
      }
    }
    return out;
  } catch {
    return [];
  }
}

export function filterSectionIdsStillInSchema(schemaText: string, ids: readonly string[]): string[] {
  const present = new Set(parseAiSectionIdsFromSchemaJson(schemaText));
  return normalizeRefineSectionIds(ids.filter((id) => present.has(id)));
}

export function compactSectionIdPrefixes(ids: readonly string[], max: number = MAX_REFINE_SECTIONS): string {
  return normalizeRefineSectionIds([...ids], max)
    .map((id) => id.slice(0, 8))
    .join("|");
}
