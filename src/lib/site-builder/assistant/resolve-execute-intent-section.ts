import type { SiteSchemaDocumentType } from "@/lib/site-builder/schema";

export type SectionResolveOutcome =
  | { ok: true; sectionId: string }
  | { ok: false; clarificationQuestion: string };

function pageBlocks(doc: SiteSchemaDocumentType, pageSlug: string) {
  const page = doc.pages.find((p) => p.slug === pageSlug);
  return page?.blocks ?? [];
}

function readRegistryKey(block: SiteSchemaDocumentType["pages"][number]["blocks"][number]): string {
  const c = block.content as { aiRegistryKey?: string } | undefined;
  return String(c?.aiRegistryKey || "").trim();
}

function readSectionId(block: SiteSchemaDocumentType["pages"][number]["blocks"][number]): string {
  const c = block.content as { aiSectionId?: string } | undefined;
  return String(c?.aiSectionId || "").trim();
}

function isHeroBlock(block: SiteSchemaDocumentType["pages"][number]["blocks"][number]): boolean {
  if (block.type === "hero") return true;
  const rk = readRegistryKey(block).toLowerCase();
  return rk.startsWith("hero_");
}

function firstMatch(
  doc: SiteSchemaDocumentType,
  pageSlug: string,
  predicate: (b: SiteSchemaDocumentType["pages"][number]["blocks"][number]) => boolean,
): SectionResolveOutcome {
  const blocks = pageBlocks(doc, pageSlug);
  const hits = blocks.filter(predicate).filter((b) => readSectionId(b));
  if (hits.length === 0) {
    return { ok: false, clarificationQuestion: "I could not find a matching section on this page." };
  }
  if (hits.length > 1) {
    return {
      ok: false,
      clarificationQuestion: "Multiple sections match. Select one on the canvas, or name the section more specifically.",
    };
  }
  return { ok: true, sectionId: readSectionId(hits[0]!) };
}

/**
 * Resolve natural-language section hints + editContext to a single `aiSectionId`.
 */
export function resolveSectionIdForExecuteIntent(
  doc: SiteSchemaDocumentType,
  pageSlug: string,
  messageLower: string,
  lastSectionIds: string[],
): SectionResolveOutcome {
  const blocks = pageBlocks(doc, pageSlug);
  const idSet = new Set(blocks.map(readSectionId).filter(Boolean));

  const referencesThisOrSelectedSection =
    /\b(this section|selected section|that section|the selected section)\b/.test(messageLower) ||
    /\b(of|for)\s+(the\s+)?(this|selected|that)\s+section\b/.test(messageLower) ||
    (/\bthis\b/.test(messageLower) && /\bsection\b/.test(messageLower));

  const backgroundOrSurfaceOnSection =
    /\b(background|bg|backdrop)\b/.test(messageLower) ||
    /\bmake\b.*\b(this|the|that|selected)\s+section\b/.test(messageLower);

  const styleVerbsOnSelection =
    /\b(change|set|make|turn|update|edit|apply)\b/.test(messageLower) &&
    (/\b(color|colour|white|light|dark|black)\b/.test(messageLower) || /#/.test(messageLower) || /\bsection\b/.test(messageLower));

  const useSelected =
    lastSectionIds.length > 0 &&
    (/\b(this section|selected section|that section|it)\b/.test(messageLower) ||
      (referencesThisOrSelectedSection && (backgroundOrSurfaceOnSection || styleVerbsOnSelection)) ||
      (!/\b(hero|footer|faq|pricing|stats|stat|cta)\b/.test(messageLower) &&
        /\b(section)\b/.test(messageLower) &&
        /\b(background|bg|backdrop|white|foreground|text color|accent)\b/.test(messageLower)) ||
      (!/\b(hero|footer|faq|pricing|stats|stat|cta|section)\b/.test(messageLower) &&
        /\b(rewrite|shorten|change|update|edit|tweak|fix)\b/.test(messageLower)));

  if (useSelected) {
    const sid = lastSectionIds[0]!.trim();
    if (idSet.has(sid)) return { ok: true, sectionId: sid };
    return { ok: false, clarificationQuestion: "The selected section is not on the current page schema." };
  }

  if (/\bhero\b/.test(messageLower)) {
    return firstMatch(doc, pageSlug, isHeroBlock);
  }

  if (/\bfooter\b/.test(messageLower)) {
    return firstMatch(doc, pageSlug, (b) => b.type === "footer" || readRegistryKey(b).toLowerCase().includes("footer"));
  }

  if (/\bfaq\b/.test(messageLower)) {
    return firstMatch(doc, pageSlug, (b) => readRegistryKey(b).toLowerCase().includes("faq"));
  }

  if (/\bstats?\b|\bstat band\b/.test(messageLower)) {
    return firstMatch(doc, pageSlug, (b) => readRegistryKey(b).toLowerCase().includes("stat"));
  }

  if (/\bpricing\b/.test(messageLower)) {
    const byPricing = firstMatch(
      doc,
      pageSlug,
      (b) =>
        readRegistryKey(b).toLowerCase().includes("feature") ||
        readRegistryKey(b).toLowerCase().includes("value_prop") ||
        readRegistryKey(b).toLowerCase().includes("pricing"),
    );
    if (byPricing.ok) return byPricing;
    return firstMatch(doc, pageSlug, (b) => readRegistryKey(b).toLowerCase().includes("grid"));
  }

  if (/\bcta\b|\bcall to action\b/.test(messageLower)) {
    return firstMatch(
      doc,
      pageSlug,
      (b) => b.type === "call_to_action" || readRegistryKey(b).toLowerCase().includes("cta"),
    );
  }

  if (lastSectionIds.length === 1 && idSet.has(lastSectionIds[0]!)) {
    return { ok: true, sectionId: lastSectionIds[0]!.trim() };
  }

  return {
    ok: false,
    clarificationQuestion:
      "Which section should I change? Select it on the canvas or mention hero, FAQ, pricing, stats, or footer.",
  };
}
