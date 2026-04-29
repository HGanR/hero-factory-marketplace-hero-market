import type { RealSignalBundle } from "@/lib/revenue-os/market-signals/types";
import type { FeedbackAggregationResult } from "@/lib/revenue-os/feedback-aggregation";
import type { MarketSweepResult } from "@/lib/revenue-os/market-sweep-schema";
import { mergeRealIntoStringBuckets, buildScoredInsightsBuckets } from "@/lib/revenue-os/market-signals/scoring";
import { computeMarketIntelligenceDiff } from "@/lib/revenue-os/market-intelligence-diff";
import { decideNextAction, mapNextActionToContentGenerationMode } from "@/lib/revenue-os/decision-engine";
import { buildGrowthGuidance } from "@/lib/revenue-os/growth-guidance";

function uniqLines(lines: string[]): string[] {
  const seen = new Set<string>();
  return lines.filter((x) => {
    const k = x.trim();
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/**
 * Merges real signals, weighted scoring, feedback-aware decisioning, diff vs prior snapshot, and growth guidance.
 */
export function finalizeMarketSweepHybrid(params: {
  parsed: MarketSweepResult;
  bundle: RealSignalBundle;
  feedback: FeedbackAggregationResult;
  priorSnapshot: MarketSweepResult | null;
}): MarketSweepResult {
  const { parsed, bundle, feedback, priorSnapshot } = params;
  const merged = mergeRealIntoStringBuckets(parsed, bundle.signals);
  const scored = buildScoredInsightsBuckets(merged, bundle.signals, feedback);
  const realSignalsSummary = bundle.signals
    .slice(0, 14)
    .map((s) => `- [${s.source}] ${s.title}`)
    .join("\n");

  const disclaimers = uniqLines([
    ...(merged.disclaimers ?? []),
    ...bundle.errors,
    ...(bundle.signals.length === 0
      ? ["No live connector lines returned — LLM synthesis only; add YOUTUBE_DATA_API_KEY for YouTube."]
      : []),
    ...(feedback.degraded && feedback.feedbackCount === 0
      ? ["Feedback loop: no stored rows yet — strategy uses live signals only."]
      : []),
  ]);

  const base: MarketSweepResult = {
    ...merged,
    scoredInsights: scored,
    realSignalsSummary: realSignalsSummary || undefined,
    disclaimers,
    hybridMeta: {
      realSignalCount: bundle.signals.length,
      sourcesConnected: Object.keys(bundle.bySource),
      connectorErrors: bundle.errors.length ? bundle.errors : undefined,
    },
  };

  const diff = computeMarketIntelligenceDiff(priorSnapshot, base);
  const nextAction = decideNextAction({
    lastSweep: base,
    feedback,
    feedbackCount: feedback.feedbackCount,
    negativeSentimentRatio: feedback.negativeSentimentRatio,
    positiveSentimentRatio: feedback.positiveSentimentRatio,
  });
  const contentGenerationMode = mapNextActionToContentGenerationMode(nextAction.action);
  const growthGuidance = buildGrowthGuidance({
    sweep: base,
    feedback,
    diff,
    nextAction,
  });

  return {
    ...base,
    nextAction,
    contentGenerationMode,
    growthGuidance,
    intelligenceDiff: diff,
  };
}
