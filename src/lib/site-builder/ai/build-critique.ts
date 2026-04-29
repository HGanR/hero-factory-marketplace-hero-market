import type { ContentBrief } from "@/lib/site-builder/ai/content-brief-schema";
import { dedupeRepeatedPhrases } from "@/lib/site-builder/ai/content-intelligence";
import type { SiteSchemaDocumentType } from "@/lib/site-builder/schema";
import { applySectionBackgroundToBlock } from "@/lib/site-builder/builder-actions/section-style-apply";

const CRITIQUE_THRESHOLD = 62;

const SURFACE_ALTERNATION = ["#ffffff", "#f8fafc", "#f1f5f9", "#eef2ff"] as const;

export type BuildCritiquePack = {
  score: number;
  issues: string[];
};

function collectHeadlines(doc: SiteSchemaDocumentType): string[] {
  const out: string[] = [];
  const page = doc.pages[0];
  if (!page?.blocks) return out;
  for (const b of page.blocks) {
    const c = b.content as Record<string, unknown> | undefined;
    if (!c) continue;
    for (const k of ["title", "headline", "subtitle", "subheadline", "headlinePrimary"]) {
      const v = c[k];
      if (typeof v === "string" && v.trim().length > 4) out.push(v.trim().toLowerCase());
    }
  }
  return out;
}

function collectSectionBackgrounds(doc: SiteSchemaDocumentType): Set<string> {
  const bg = new Set<string>();
  const page = doc.pages[0];
  if (!page?.blocks) return bg;
  for (const b of page.blocks) {
    const style = (b.content as { style?: { backgroundColor?: string } } | undefined)?.style;
    const c = String(style?.backgroundColor || "").trim().toLowerCase();
    if (c) bg.add(c);
  }
  return bg;
}

/**
 * Deterministic post-generation critique (layout/copy heuristics, no extra LLM).
 */
export function critiqueSiteBuild(doc: SiteSchemaDocumentType, industry: string): BuildCritiquePack {
  const issues: string[] = [];
  let score = 100;
  const page = doc.pages[0];
  if (!page?.blocks?.length) return { score: 35, issues: ["empty_page"] };

  const headlines = collectHeadlines(doc);
  const generic = /\b(professional services|solutions?\s+and\s+advisory|trusted partner for growth)\b/i;
  if (headlines.some((h) => generic.test(h))) {
    issues.push("generic_headline");
    score -= 14;
  }

  for (let i = 0; i < headlines.length; i++) {
    for (let j = i + 1; j < headlines.length; j++) {
      const a = headlines[i]!;
      const b = headlines[j]!;
      if (a.length < 12 || b.length < 12) continue;
      if (a.includes(b.slice(0, Math.min(24, b.length))) || b.includes(a.slice(0, Math.min(24, a.length)))) {
        issues.push("duplicate_headline_phrasing");
        score -= 12;
        break;
      }
    }
    if (issues.includes("duplicate_headline_phrasing")) break;
  }

  const bgSet = collectSectionBackgrounds(doc);
  if (bgSet.size <= 1 && page.blocks.length > 3) {
    issues.push("sections_same_surface");
    score -= 10;
  }

  const ind = industry.toLowerCase();
  if (/\bweb3|crypto|defi|blockchain|on-?chain\b/.test(ind)) {
    const has = headlines.some((h) => /\b(wallet|on-?chain|governance|token|defi|protocol)\b/i.test(h));
    if (!has) {
      issues.push("industry_terms_thin");
      score -= 10;
    }
  }
  if (/\b(salon|barber|spa|booking)\b/.test(ind)) {
    const has = headlines.some((h) => /\b(book|appointment|chair|cut|color|stylist)\b/i.test(h));
    if (!has) {
      issues.push("local_booking_language_thin");
      score -= 8;
    }
  }

  const ctaish = page.blocks
    .map((b) => {
      const c = b.content as Record<string, unknown> | undefined;
      return [c?.primaryCta, c?.ctaLabel, c?.label].map((x) => (typeof x === "string" ? x.toLowerCase() : "")).join(" ");
    })
    .join(" ");
  if (/\blearn more\b/.test(ctaish) && !/\b(book|schedule|call|start|get|join)\b/.test(ctaish)) {
    issues.push("weak_cta");
    score -= 8;
  }

  return { score: Math.max(0, Math.min(100, score)), issues: [...new Set(issues)] };
}

function repairStringsInBlocks(doc: SiteSchemaDocumentType): void {
  const keys = new Set([
    "title",
    "subtitle",
    "headline",
    "subheadline",
    "body",
    "description",
    "primaryCta",
    "secondaryCta",
    "ctaLabel",
    "label",
  ]);
  for (const p of doc.pages) {
    for (const b of p.blocks) {
      const c = b.content as Record<string, unknown> | undefined;
      if (!c) continue;
      for (const k of Object.keys(c)) {
        if (keys.has(k) && typeof c[k] === "string") {
          c[k] = dedupeRepeatedPhrases(String(c[k]));
        }
      }
    }
  }
}

/**
 * Light auto-repair when critique score is below threshold (copy dedupe, surfaces, CTA nudge).
 */
export function applyBuildCritiqueRepairs(
  doc: SiteSchemaDocumentType,
  brief: ContentBrief,
  pack: BuildCritiquePack,
): { doc: SiteSchemaDocumentType; repaired: boolean } {
  if (pack.score >= CRITIQUE_THRESHOLD) return { doc, repaired: false };

  const working = JSON.parse(JSON.stringify(doc)) as SiteSchemaDocumentType;
  let repaired = false;

  if (pack.issues.includes("sections_same_surface")) {
    const blocks = working.pages[0]?.blocks;
    if (blocks?.length) {
      let i = 0;
      for (const b of blocks) {
        if (b.type === "footer") continue;
        applySectionBackgroundToBlock(b, SURFACE_ALTERNATION[i % SURFACE_ALTERNATION.length]!);
        i += 1;
      }
      repaired = true;
    }
  }

  if (pack.issues.includes("generic_headline") || pack.issues.includes("industry_terms_thin")) {
    const blocks = working.pages[0]?.blocks;
    const hero = blocks?.find((x) => x.type === "hero");
    if (hero?.content && typeof hero.content === "object") {
      const o = hero.content as Record<string, unknown>;
      const ind = brief.industry?.trim() || "your market";
      if (typeof o.title === "string") {
        o.title = dedupeRepeatedPhrases(
          `Ship faster in ${ind.split(/[,;]/)[0]!.trim()} — outcomes your team can measure`,
        );
        repaired = true;
      }
      if (typeof o.subtitle === "string" && o.subtitle.length < 28) {
        o.subtitle = dedupeRepeatedPhrases(String(brief.primaryOffer || o.subtitle).slice(0, 160));
        repaired = true;
      }
      if (typeof o.primaryCta === "string" && /\blearn more\b/i.test(String(o.primaryCta))) {
        o.primaryCta = brief.ctaPrimary || `Book a ${ind.slice(0, 32)} strategy call`;
        repaired = true;
      }
      if (typeof o.secondaryCta === "string" && /\blearn more\b/i.test(String(o.secondaryCta))) {
        o.secondaryCta = brief.ctaSecondary || o.secondaryCta;
        repaired = true;
      }
    }
  }

  const beforeStrings = JSON.stringify(working);
  repairStringsInBlocks(working);
  if (JSON.stringify(working) !== beforeStrings) repaired = true;
  return { doc: working, repaired };
}

export { CRITIQUE_THRESHOLD };
