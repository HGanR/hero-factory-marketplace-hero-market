/**
 * Read-only summaries for Site Builder variant cards (no planner/generator changes).
 */
import { getLayoutFamilyById } from "@/lib/site-builder/ai/layout-families";

type VariantGenerationMeta = {
  layoutFamilyId?: string;
  diversityScore?: number;
  retryCount?: number;
};

export type SiteVariantPreviewMeta = {
  heroHeadline: string;
  homeSectionCount: number;
  /** Distinct registry keys on home page, truncated for display */
  registryKeys: string[];
  layoutFamilyLabel: string;
  heroStyle: string;
  ctaStrategy: string;
  firstSectionTypes: string[];
};

function readContent(block: { content?: unknown } | undefined): Record<string, unknown> {
  const c = block?.content;
  return c && typeof c === "object" && !Array.isArray(c) ? (c as Record<string, unknown>) : {};
}

/**
 * Best-effort hero title + home block count + registry keys from a site schema document.
 */
export function extractSiteVariantPreviewMeta(doc: unknown, generationMeta?: VariantGenerationMeta): SiteVariantPreviewMeta {
  const d = doc as { pages?: Array<{ blocks?: unknown[] }> } | null | undefined;
  const blocks = (Array.isArray(d?.pages?.[0]?.blocks) ? d!.pages![0]!.blocks : []) as Array<{
    type?: string;
    content?: unknown;
  }>;

  let heroHeadline = "—";
  for (const b of blocks) {
    if (String(b?.type || "") === "hero") {
      const c = readContent(b);
      const t = c.title ?? c.headline;
      if (typeof t === "string" && t.trim()) {
        heroHeadline = t.trim().slice(0, 100);
        break;
      }
    }
  }

  const keys: string[] = [];
  for (const b of blocks) {
    const rk = String(readContent(b).aiRegistryKey || "").trim();
    if (rk && !keys.includes(rk)) keys.push(rk);
  }
  const family = getLayoutFamilyById(generationMeta?.layoutFamilyId);

  return {
    heroHeadline,
    homeSectionCount: blocks.length,
    registryKeys: keys.slice(0, 10),
    layoutFamilyLabel: family?.label ?? "Auto family",
    heroStyle: family?.heroStyle ?? "auto",
    ctaStrategy: family?.ctaStrategy ?? "auto",
    firstSectionTypes: keys.slice(0, 4),
  };
}

export function pickSchemaForVariantIndex(
  primary: unknown,
  alternates: Array<{ seed: string; schema: unknown }>,
  index: number,
): unknown | null {
  if (index === 0) return primary;
  return alternates[index - 1]?.schema ?? null;
}

export function buildVariantPickerItems(
  primary: unknown,
  alternates: Array<{ seed: string; schema: unknown; generationMeta?: VariantGenerationMeta }>,
  primaryGenerationMeta?: VariantGenerationMeta,
): Array<{ index: number; label: string; schema: unknown; seed?: string; generationMeta?: VariantGenerationMeta }> {
  const out: Array<{ index: number; label: string; schema: unknown; seed?: string; generationMeta?: VariantGenerationMeta }> = [
    { index: 0, label: "Layout A", schema: primary, seed: undefined, generationMeta: primaryGenerationMeta },
  ];
  alternates.forEach((a, j) => {
    const letter = String.fromCharCode(66 + j);
    out.push({ index: j + 1, label: `Layout ${letter}`, schema: a.schema, seed: a.seed, generationMeta: a.generationMeta });
  });
  return out;
}
