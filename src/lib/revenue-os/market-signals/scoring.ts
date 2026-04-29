import type { RealMarketSignal } from "@/lib/revenue-os/market-signals/types";
import type { FeedbackAggregationResult } from "@/lib/revenue-os/feedback-aggregation";
import type {
  MarketSweepResult,
  ScoredInsight,
  ScoredInsightsBuckets,
  SignalConfidence,
} from "@/lib/revenue-os/market-sweep-schema";

const BUCKET_KEYS = [
  "trendingTopics",
  "viralHooks",
  "painPoints",
  "buyingSignals",
  "commentInsights",
  "competitorAngles",
  "contentGaps",
] as const;

export type SweepBucketKey = (typeof BUCKET_KEYS)[number];

function norm(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

function clamp01(x: number): number {
  return Math.min(1, Math.max(0, x));
}

/** Heuristic bucket assignment for a raw signal (can map to multiple buckets). */
export function assignSignalToBuckets(signal: RealMarketSignal): SweepBucketKey[] {
  const t = norm(`${signal.title} ${signal.snippet ?? ""}`);
  const buckets = new Set<SweepBucketKey>();

  if (/how to|tutorial|trend|viral|#|shorts|fyp|202\d/i.test(t)) {
    buckets.add("trendingTopics");
  }
  if (/hook|pov|stop doing|watch this|secret|nobody/i.test(t)) {
    buckets.add("viralHooks");
  }
  if (/struggle|pain|fail|problem|frustrat|anxiety|worried|stuck/i.test(t)) {
    buckets.add("painPoints");
  }
  if (/price|buy|roi|worth it|budget|subscribe|trial|discount|purchase/i.test(t)) {
    buckets.add("buyingSignals");
  }
  if (/comment|thread|reddit|discussion|asked|question/i.test(t)) {
    buckets.add("commentInsights");
  }
  if (/vs |compet|alternative|brand|incumbent|market leader/i.test(t)) {
    buckets.add("competitorAngles");
  }
  if (/gap|missing|nobody talks|underserved|no one/i.test(t)) {
    buckets.add("contentGaps");
  }

  if (buckets.size === 0) {
    buckets.add("commentInsights");
    buckets.add("trendingTopics");
  }

  return [...buckets];
}

function confidenceFromSources(
  source: RealMarketSignal["source"],
  frequency: number
): SignalConfidence {
  if (source === "reddit" && frequency >= 2) return "high";
  if (source === "youtube" && frequency >= 2) return "high";
  if (frequency >= 2) return "medium";
  return "medium";
}

function sourceTrustWeightForSource(source: RealMarketSignal["source"] | undefined): number {
  if (source === "youtube") return 0.94;
  if (source === "reddit") return 0.87;
  return 1;
}

function recencyWeightForIndex(index: number, batchSize: number): number {
  if (batchSize <= 1) return 1;
  return clamp01(0.82 + 0.18 * (1 - index / Math.max(batchSize - 1, 1)));
}

function commercialIntentFromText(text: string): number {
  const t = norm(text);
  if (/buy|price|roi|demo|book|call|subscribe|offer|discount|trial|coupon/i.test(t)) return 1;
  if (/how to|what is|tips|guide|learn/i.test(t)) return 0.88;
  return 0.78;
}

function applyLeadBiasToWeight(
  w: number,
  text: string,
  feedback: FeedbackAggregationResult | null | undefined
): number {
  const lb = feedback?.leadSignalBias;
  if (!lb || lb.totalSignals < 1) return w;
  const t = norm(text);
  let m = 1;
  if (lb.objectionClusterCount >= 2 && /how|why|what|proof|explain|myth|mistake|tutorial|guide/i.test(t)) {
    m *= 1.05;
  }
  if (lb.highIntentCount >= 3 && /buy|book|apply|roi|pricing|offer|demo|cta|subscribe/i.test(t)) {
    m *= 1.06;
  }
  if (lb.trustSeekingCount >= 2 && /case|testimonial|proof|review|result|before|after|warranty/i.test(t)) {
    m *= 1.05;
  }
  if (lb.handoffReadyCount >= 3 && /book|call|apply|dm|schedule|link|calendar/i.test(t)) {
    m *= 1.04;
  }
  return Math.min(1.28, w * m);
}

function feedbackPerformanceWeightForText(
  text: string,
  feedback: FeedbackAggregationResult | null | undefined
): number {
  if (!feedback) return 1;
  const t = norm(text);
  let w = 1;

  if (feedback.feedbackCount > 0) {
    for (const x of feedback.topPerformingTopics) {
      const nx = norm(x);
      if (nx.length >= 3 && (t.includes(nx) || nx.includes(t.slice(0, Math.min(24, t.length))))) {
        w = 1.12;
        return applyLeadBiasToWeight(w, text, feedback);
      }
    }
    for (const x of feedback.underperformingTopics) {
      const nx = norm(x);
      if (nx.length >= 3 && (t.includes(nx) || nx.includes(t.slice(0, Math.min(24, t.length))))) {
        w = 0.86;
        return applyLeadBiasToWeight(w, text, feedback);
      }
    }
    for (const x of feedback.experimentBoostHookTypes ?? []) {
      const nx = norm(x);
      if (nx.length >= 2 && t.includes(nx)) {
        w = 1.08;
        return applyLeadBiasToWeight(w, text, feedback);
      }
    }
    for (const x of feedback.experimentSuppressAngles ?? []) {
      const nx = norm(x);
      if (nx.length >= 4 && (t.includes(nx.slice(0, 40)) || nx.includes(t.slice(0, 30)))) {
        w = 0.9;
        return applyLeadBiasToWeight(w, text, feedback);
      }
    }
  }

  return applyLeadBiasToWeight(w, text, feedback);
}

function combineWeightedScore(
  base: number,
  w: {
    recencyWeight: number;
    sourceTrustWeight: number;
    commercialIntentWeight: number;
    feedbackPerformanceWeight: number;
  }
): number {
  return clamp01(
    base * w.recencyWeight * w.sourceTrustWeight * w.commercialIntentWeight * w.feedbackPerformanceWeight
  );
}

/**
 * Deduped raw signals with base strength (before hybrid weights).
 */
export function scoreRealSignals(signals: RealMarketSignal[]): ScoredInsight[] {
  const map = new Map<string, { signal: RealMarketSignal; count: number }>();
  for (const s of signals) {
    const k = norm(s.title);
    if (!k) continue;
    const cur = map.get(k);
    if (cur) cur.count += 1;
    else map.set(k, { signal: s, count: 1 });
  }

  const list = [...map.values()];
  const scored: ScoredInsight[] = [];
  let idx = 0;
  for (const { signal, count } of list) {
    const base = signal.source === "youtube" ? 0.45 : 0.4;
    const baseScore = Math.min(
      1,
      base + 0.08 * Math.min(count, 5) + Math.min(signal.title.length / 400, 0.15)
    );
    const recencyWeight = recencyWeightForIndex(idx, list.length);
    const sourceTrustWeight = sourceTrustWeightForSource(signal.source);
    const commercialIntentWeight = commercialIntentFromText(`${signal.title} ${signal.snippet ?? ""}`);
    const feedbackPerformanceWeight = 1;
    const score = combineWeightedScore(baseScore, {
      recencyWeight,
      sourceTrustWeight,
      commercialIntentWeight,
      feedbackPerformanceWeight,
    });
    scored.push({
      text: signal.title,
      score,
      confidence: confidenceFromSources(signal.source, count),
      frequency: count,
      source: signal.source,
      recencyWeight,
      sourceTrustWeight,
      commercialIntentWeight,
      feedbackPerformanceWeight,
    });
    idx += 1;
  }
  scored.sort((a, b) => b.score - a.score);
  return scored;
}

function applyFeedbackToInsight(
  row: ScoredInsight,
  textForMatch: string,
  feedback: FeedbackAggregationResult | null | undefined
): ScoredInsight {
  const fbw = feedbackPerformanceWeightForText(textForMatch, feedback);
  if (fbw === 1) return row;
  const prevFb = row.feedbackPerformanceWeight ?? 1;
  const ratio = fbw / prevFb;
  return {
    ...row,
    feedbackPerformanceWeight: fbw,
    score: clamp01(row.score * ratio),
  };
}

function defaultScoredLine(
  text: string,
  source: ScoredInsight["source"],
  feedback: FeedbackAggregationResult | null | undefined
): ScoredInsight {
  const commercialIntentWeight = commercialIntentFromText(text);
  const base = source === "llm" ? 0.42 : 0.5;
  const fbw = feedbackPerformanceWeightForText(text, feedback);
  const score = combineWeightedScore(base, {
    recencyWeight: 1,
    sourceTrustWeight: 1,
    commercialIntentWeight,
    feedbackPerformanceWeight: fbw,
  });
  return {
    text,
    score,
    confidence: "low",
    frequency: 1,
    source,
    recencyWeight: 1,
    sourceTrustWeight: 1,
    commercialIntentWeight,
    feedbackPerformanceWeight: fbw,
  };
}

/**
 * Builds per-bucket scored lists from real signals + LLM string lines.
 */
export function buildScoredInsightsBuckets(
  llm: MarketSweepResult,
  realSignals: RealMarketSignal[],
  feedback?: FeedbackAggregationResult | null
): ScoredInsightsBuckets {
  const buckets: ScoredInsightsBuckets = {};
  const realScored = scoreRealSignals(realSignals);

  for (const key of BUCKET_KEYS) {
    const scored: ScoredInsight[] = [];

    for (const rs of realScored) {
      const sig = realSignals.find((s) => norm(s.title) === norm(rs.text));
      if (!sig) continue;
      if (!assignSignalToBuckets(sig).includes(key)) continue;
      const merged = applyFeedbackToInsight(
        { ...rs, text: `[${sig.source}] ${sig.title}`, source: "merged" },
        `${sig.title} ${sig.snippet ?? ""}`,
        feedback
      );
      scored.push(merged);
    }

    for (const line of llm[key] ?? []) {
      scored.push(defaultScoredLine(line, "llm", feedback));
    }

    const seen = new Set<string>();
    const deduped: ScoredInsight[] = [];
    for (const row of scored) {
      const k = norm(row.text);
      if (seen.has(k)) continue;
      seen.add(k);
      deduped.push(row);
    }
    buckets[key] = deduped.slice(0, 32);
  }

  return buckets;
}

/**
 * Merges top real lines into LLM buckets (prefix) so string arrays stay the primary contract.
 */
export function mergeRealIntoStringBuckets(
  llm: MarketSweepResult,
  realSignals: RealMarketSignal[],
  maxPerBucket = 3
): MarketSweepResult {
  const scored = scoreRealSignals(realSignals);
  const additions = new Map<SweepBucketKey, string[]>();
  for (const key of BUCKET_KEYS) {
    additions.set(key, []);
  }

  for (const rs of scored) {
    const sig = realSignals.find((s) => s.title === rs.text);
    if (!sig) continue;
    for (const bucket of assignSignalToBuckets(sig)) {
      const arr = additions.get(bucket)!;
      if (arr.length >= maxPerBucket) continue;
      const line = `[${sig.source}] ${sig.title}`;
      if (!arr.includes(line)) arr.push(line);
    }
  }

  const out = { ...llm };
  for (const key of BUCKET_KEYS) {
    const add = additions.get(key) ?? [];
    const existing = out[key] ?? [];
    const merged = [...add, ...existing];
    const seen = new Set<string>();
    out[key] = merged
      .filter((line) => {
        const k = norm(line);
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      })
      .slice(0, 32);
  }
  return out;
}
