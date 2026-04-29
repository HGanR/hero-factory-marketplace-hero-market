/**
 * Collect section ids on a page that can use regenerate/batch (need registry key for rebuild).
 */

const BATCH_CAP = 3;

export function listRefinableSectionIdsOnPage(
  schemaJson: string,
  pageSlug: string = "/",
): string[] {
  try {
    const doc = JSON.parse(schemaJson) as {
      pages?: Array<{ slug?: string; blocks?: Array<{ content?: Record<string, unknown> }> }>;
    };
    const page = doc.pages?.find((p) => String(p.slug ?? "/").trim() === pageSlug.trim());
    if (!page?.blocks?.length) return [];
    const out: string[] = [];
    for (const b of page.blocks) {
      const c = (b.content || {}) as { aiSectionId?: string; aiRegistryKey?: string };
      const sid = String(c.aiSectionId || "").trim();
      const rk = String(c.aiRegistryKey || "").trim();
      if (sid && rk) out.push(sid);
    }
    return out;
  } catch {
    return [];
  }
}

export function chunkSectionIdsForBatch(ids: string[], chunkSize = BATCH_CAP): string[][] {
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += chunkSize) {
    chunks.push(ids.slice(i, i + chunkSize));
  }
  return chunks;
}

export function shouldPreferLightPageRefinement(refinableHomeSectionCount: number): boolean {
  return refinableHomeSectionCount > 0;
}
