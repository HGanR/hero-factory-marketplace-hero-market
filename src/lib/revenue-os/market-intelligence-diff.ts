/**
 * Compares current market sweep output to a prior persisted snapshot (same query fingerprint).
 */

import type { MarketIntelligenceDiff, MarketSweepResult } from "@/lib/revenue-os/market-sweep-schema";

export type { MarketIntelligenceDiff };

function norm(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

function asSet(arr: string[] | undefined): Set<string> {
  return new Set((arr ?? []).map(norm).filter(Boolean));
}

function tokenOverlap(a: string, b: string): boolean {
  if (a.length < 4 || b.length < 4) return a === b;
  return a.includes(b.slice(0, 12)) || b.includes(a.slice(0, 12));
}

/**
 * Diff trending topics + viral hooks between two sweep results.
 */
export function computeMarketIntelligenceDiff(
  prior: MarketSweepResult | null | undefined,
  current: MarketSweepResult
): MarketIntelligenceDiff {
  if (!prior) {
    return {
      hasPrior: false,
      newTopics: [],
      droppedTopics: [],
      strengthenedHooks: [],
      weakenedHooks: [],
      summary: "No prior market intelligence snapshot for this query — baseline established.",
    };
  }

  const prevT = asSet(prior.trendingTopics);
  const curT = asSet(current.trendingTopics);
  const newTopics: string[] = [];
  for (const x of current.trendingTopics ?? []) {
    const n = norm(x);
    if (!n) continue;
    let found = prevT.has(n);
    if (!found) {
      for (const p of prevT) {
        if (tokenOverlap(n, p)) {
          found = true;
          break;
        }
      }
    }
    if (!found) newTopics.push(x);
  }
  const droppedTopics: string[] = [];
  for (const x of prior.trendingTopics ?? []) {
    const n = norm(x);
    if (!n) continue;
    let found = curT.has(n);
    if (!found) {
      for (const c of curT) {
        if (tokenOverlap(n, c)) {
          found = true;
          break;
        }
      }
    }
    if (!found) droppedTopics.push(x);
  }

  const prevHooks = prior.scoredInsights?.viralHooks ?? [];
  const curHooks = current.scoredInsights?.viralHooks ?? [];
  const prevByText = new Map(prevHooks.map((h) => [norm(h.text), h.score]));
  const strengthenedHooks: string[] = [];
  const weakenedHooks: string[] = [];
  for (const h of curHooks) {
    const k = norm(h.text);
    const was = prevByText.get(k);
    if (was != null && h.score > was + 0.08) strengthenedHooks.push(h.text);
    if (was != null && h.score < was - 0.08) weakenedHooks.push(h.text);
  }

  const parts: string[] = [];
  if (newTopics.length) parts.push(`${newTopics.length} rising theme(s) vs last sweep.`);
  if (droppedTopics.length) parts.push(`${droppedTopics.length} theme(s) cooled.`);
  if (strengthenedHooks.length) parts.push(`${strengthenedHooks.length} hook line(s) gained strength.`);
  if (weakenedHooks.length) parts.push(`${weakenedHooks.length} hook line(s) softened.`);

  const summary =
    parts.join(" ") ||
    "Sweep stable vs prior — minor or no structural change in tracked buckets.";

  return {
    hasPrior: true,
    newTopics: newTopics.slice(0, 12),
    droppedTopics: droppedTopics.slice(0, 12),
    strengthenedHooks: strengthenedHooks.slice(0, 8),
    weakenedHooks: weakenedHooks.slice(0, 8),
    summary,
  };
}
