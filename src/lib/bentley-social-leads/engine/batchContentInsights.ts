/**
 * Deterministic batch-level content guidance from analyzed lead rows (for Content Bundle / campaigns).
 */

import type { LeadAnalysisRow } from "../queryTypes";
import type { ContentInsightsBatch } from "./domainTypes";

function bump(map: Record<string, number>, key: string): void {
  map[key] = (map[key] ?? 0) + 1;
}

/**
 * Aggregate themes, hooks, objections, and “what to post next” from engine fields + evidence.
 */
export function buildContentInsightsBatch(rows: LeadAnalysisRow[]): ContentInsightsBatch {
  const painCounts: Record<string, number> = {};
  const objectionCounts: Record<string, number> = {};
  const hooks: string[] = [];
  const ctas: string[] = [];
  const offers: string[] = [];

  for (const r of rows) {
    if (r.enginePainType) bump(painCounts, r.enginePainType);
    if (r.engineRecommendedHook) hooks.push(r.engineRecommendedHook);
    if (r.engineRecommendedCta) ctas.push(r.engineRecommendedCta);
    if (r.bestOfferAngle) offers.push(r.bestOfferAngle);

    const ev = r.evidenceJson;
    if (ev?.objectionThemes) {
      for (const o of ev.objectionThemes.slice(0, 2)) {
        bump(objectionCounts, o.slice(0, 120));
      }
    }
  }

  const topRecurringPainThemes = Object.entries(painCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([theme, count]) => ({ theme, count }));

  const topObjections = Object.entries(objectionCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([text, count]) => ({ text, count }));

  const topHooks = [...new Set(hooks)].slice(0, 10);
  const ctaAngles = [...new Set(ctas)].slice(0, 8);
  const offerAngles = [...new Set(offers)].slice(0, 8);

  const pillars = [
    "Proof & trust: reviews, screenshots, before/after",
    "Process clarity: how you work in 3 steps",
    "Objection handling: price, time, trust",
    "Local relevance: city/service area",
    "Offer specificity: one clear transformation",
  ];

  const marketSummary =
    topRecurringPainThemes.length > 0
      ? `Recurring pain themes in this batch: ${topRecurringPainThemes
          .slice(0, 5)
          .map((x) => x.theme)
          .join(", ")}. Use their language in hooks and CTAs.`
      : "No strong recurring pain themes yet — widen the feed or add more commented leads.";

  const whatToPostNext = [
    `Address "${topRecurringPainThemes[0]?.theme ?? "lead quality"}" with a story or proof post.`,
    topObjections[0]
      ? `Neutralize “${topObjections[0].text.slice(0, 80)}…” with a short FAQ or Reel.`
      : "Surface one buyer question from comments as your next hook.",
    "Pin one comment-driven hook from this batch as your next post opener.",
  ];

  return {
    schemaVersion: 1,
    topRecurringPainThemes,
    hookIdeas: topHooks,
    topObjections,
    ctaAngles,
    offerAngles,
    contentPillars: pillars,
    marketSummary,
    whatToPostNext,
    generatedAt: new Date().toISOString(),
  };
}
