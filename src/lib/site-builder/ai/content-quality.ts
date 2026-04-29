import type { ContentBrief } from "@/lib/site-builder/ai/content-brief-schema";
import type { SiteSchemaDocumentType } from "@/lib/site-builder/schema";

const VAGUE = /\b(professional services|solutions?|innovative|cutting-?edge|world-?class|leverage|synergy)\b/gi;
const GENERIC_CTA = /^(learn more|get started|click here|read more|submit|contact us)$/i;
/** If score (0–100) is below this, run automatic content repair. */
export const CONTENT_REPAIR_SCORE_THRESHOLD = 72;

export type ContentQualityResult = {
  /** 0–100, higher = better. */
  score: number;
  issues: string[];
  suggestedFixes: string[];
};

function collectText(doc: SiteSchemaDocumentType): string {
  const parts: string[] = [doc.metadata.title, doc.metadata.description || ""].filter(Boolean);
  for (const p of doc.pages) {
    for (const b of p.blocks) {
      const c = b.content;
      if (!c || typeof c !== "object") continue;
      for (const v of Object.values(c)) {
        if (typeof v === "string") parts.push(v);
        else if (Array.isArray(v) && v.every((x) => typeof x === "string")) {
          parts.push((v as string[]).join(" "));
        }
      }
    }
  }
  return parts.join(" \n ");
}

function countRepeatedNgrams(text: string, n = 4): number {
  const w = text.toLowerCase().split(/\s+/).filter(Boolean);
  if (w.length < n * 2) return 0;
  let rep = 0;
  for (let len = 2; len <= n; len++) {
    for (let i = 0; i + len * 2 <= w.length; i++) {
      const a = w.slice(i, i + len).join(" ");
      const b = w.slice(i + len, i + len * 2).join(" ");
      if (a === b && a.length > 3) rep += 1;
    }
  }
  return rep;
}

/**
 * Heuristic copy quality: repeated phrases, vague language, missing offer/CTA/audience vs brief.
 */
export function scoreContentQuality(
  document: SiteSchemaDocumentType,
  brief: ContentBrief,
): ContentQualityResult {
  const text = collectText(document);
  const issues: string[] = [];
  const suggestedFixes: string[] = [];
  let score = 100;

  const repeated = countRepeatedNgrams(text, 4);
  if (repeated > 0) {
    const pen = Math.min(28, repeated * 7);
    score -= pen;
    issues.push(`repeated_phrase_segments:${repeated}`);
    suggestedFixes.push("Remove repeated adjacent phrases in headlines and body");
  }

  const vague = text.match(VAGUE);
  if (vague && vague.length > 2) {
    const pen = Math.min(18, (vague.length - 2) * 3);
    score -= pen;
    issues.push("vague_marketing_phrases");
    suggestedFixes.push("Replace generic terms with specific offer and industry outcomes");
  }

  if (brief.audience && !text.toLowerCase().includes(brief.audience.toLowerCase().slice(0, 12))) {
    score -= 6;
    issues.push("audience_not_reflected");
    suggestedFixes.push("Echo audience in hero or first section");
  }
  if (brief.primaryOffer) {
    const p = brief.primaryOffer.toLowerCase().slice(0, 24);
    if (!text.toLowerCase().includes(p) && p.length > 4) {
      score -= 8;
      issues.push("primary_offer_not_reflected");
      suggestedFixes.push("Surface the primary offer in the hero and at least one CTA");
    }
  }

  if (!/contact|book|call|start|get|request|join|connect|claim|see how/i.test(text)) {
    score -= 10;
    issues.push("weak_or_missing_cta_verb");
    suggestedFixes.push("Use a concrete CTA (book, get a quote, start consult)");
  }

  let ctaMatch = 0;
  for (const page of document.pages) {
    for (const b of page.blocks) {
      const c = b.content;
      if (b.type === "hero" && c && typeof c === "object" && "primaryCta" in c) {
        const pc = (c as { primaryCta?: string }).primaryCta;
        if (typeof pc === "string" && GENERIC_CTA.test(pc.trim())) {
          score -= 5;
          issues.push("hero_generic_learn_more");
          suggestedFixes.push("Tie primary CTA to the conversion goal");
        }
      }
      if (b.type === "button" || b.type === "call_to_action" || b.type === "big_link" || b.type === "internal_big_link") {
        if (c && typeof c === "object") {
          for (const v of Object.values(c)) {
            if (typeof v === "string" && v.trim() && !GENERIC_CTA.test(v.trim())) ctaMatch += 1;
            if (typeof v === "string" && v.trim() && GENERIC_CTA.test(v.trim())) ctaMatch -= 0.3;
          }
        }
      }
    }
  }
  if (ctaMatch < 0.2 && document.pages[0]?.blocks?.length) {
    if (!issues.includes("weak_or_missing_cta_verb")) {
      issues.push("few_distinctive_cta_labels");
      score -= 6;
    }
  }

  for (const kw of brief.keywordTargets) {
    if (kw && !text.toLowerCase().includes(kw.toLowerCase())) {
      score -= 2;
    }
  }
  if (brief.trustSignals.length) {
    const tlow = text.toLowerCase();
    if (!brief.trustSignals.some((s) => tlow.includes(s.toLowerCase().slice(0, 10)))) {
      score -= 5;
      issues.push("proof_or_trust_light");
    }
  }

  const h = document.pages[0]?.blocks.find((b) => b.type === "hero");
  if (h?.content && typeof h.content === "object") {
    const title = typeof h.content.title === "string" ? h.content.title : "";
    if (title && title.length < 18) {
      score -= 4;
      issues.push("headline_too_broad");
    }
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  if (suggestedFixes.length > 3) {
    suggestedFixes.splice(3, suggestedFixes.length - 3);
  }
  return { score, issues, suggestedFixes };
}

export function shouldRepairContent(score: number, threshold = CONTENT_REPAIR_SCORE_THRESHOLD): boolean {
  return score < threshold;
}
