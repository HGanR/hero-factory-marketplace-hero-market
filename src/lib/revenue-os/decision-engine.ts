import type { MarketSweepResult, ContentGenerationMode } from "@/lib/revenue-os/market-sweep-schema";
import type { FeedbackAggregationResult } from "@/lib/revenue-os/feedback-aggregation";

/**
 * Lightweight strategy adapter: uses hybrid sweep output + coarse feedback signals
 * to suggest the next Bentley action (does not execute — callers decide).
 */

export type MarketDecisionState = {
  lastSweep?: MarketSweepResult | null;
  /** Recent feedback rows or aggregate count (product-defined window). */
  feedbackCount?: number;
  /** Negative sentiment ratio 0–1 if tracked. */
  negativeSentimentRatio?: number;
  /** Positive sentiment ratio 0–1 when sentiment labels exist. */
  positiveSentimentRatio?: number;
  failedPhase?: string | null;
  /** Full feedback aggregate (preferred when present). */
  feedback?: FeedbackAggregationResult | null;
};

export type NextActionDecision = {
  action:
    | "run_sweep"
    | "double_down_content"
    | "iterate_messaging"
    | "pause_and_research"
    | "continue_pipeline";
  reason: string;
  priority: number;
};

function avgRealScore(ms: MarketSweepResult | null | undefined): number {
  const buckets = ms?.scoredInsights;
  if (!buckets) return 0;
  const rows = [
    ...(buckets.trendingTopics ?? []),
    ...(buckets.viralHooks ?? []),
    ...(buckets.painPoints ?? []),
    ...(buckets.buyingSignals ?? []),
    ...(buckets.commentInsights ?? []),
  ];
  const merged = rows.filter((r) => r.source === "merged" || r.source === "reddit" || r.source === "youtube");
  if (!merged.length) return 0;
  const sum = merged.reduce((acc, r) => acc + r.score, 0);
  return sum / merged.length;
}

export function mapNextActionToContentGenerationMode(action: NextActionDecision["action"]): ContentGenerationMode {
  switch (action) {
    case "double_down_content":
      return "scale_winners";
    case "iterate_messaging":
      return "iterate_messaging";
    case "pause_and_research":
      return "research_first";
    case "run_sweep":
      return "balanced";
    default:
      return "balanced";
  }
}

export function decideNextAction(state: MarketDecisionState): NextActionDecision {
  const fb = state.feedback;
  const feedbackCount = fb?.feedbackCount ?? state.feedbackCount ?? 0;
  const negativeSentimentRatio = fb?.negativeSentimentRatio ?? state.negativeSentimentRatio ?? 0;
  const positiveSentimentRatio = fb?.positiveSentimentRatio ?? state.positiveSentimentRatio ?? 0;
  const { lastSweep, failedPhase } = state;
  const realCount = lastSweep?.hybridMeta?.realSignalCount ?? 0;
  const avg = avgRealScore(lastSweep);
  const topTopicCount = fb?.topPerformingTopics?.length ?? 0;

  if (failedPhase && failedPhase !== "market_sweep") {
    return {
      action: "continue_pipeline",
      reason: "Recover pipeline after phase failure — re-run the failed step with context.",
      priority: 2,
    };
  }

  if (realCount === 0 && feedbackCount === 0) {
    return {
      action: "pause_and_research",
      reason: "No live connector lines and no stored feedback — add YOUTUBE_DATA_API_KEY or capture feedback before scaling.",
      priority: 4,
    };
  }

  if (negativeSentimentRatio > 0.35 && feedbackCount >= 3) {
    return {
      action: "iterate_messaging",
      reason: "Feedback skews negative — tighten proof, objections, and hooks before more spend.",
      priority: 5,
    };
  }

  const lb = fb?.leadSignalBias;
  if (lb && lb.totalSignals >= 3) {
    if (lb.objectionClusterCount >= 2 && lb.highIntentCount < 2) {
      return {
        action: "iterate_messaging",
        reason: "Lead signals show objection clusters — educate and handle objections before scaling volume.",
        priority: 5,
      };
    }
    if (lb.highIntentCount >= 3 && lb.handoffReadyCount >= 2) {
      return {
        action: "double_down_content",
        reason: "High commercial intent and handoff-ready lead signals — double down on CTA-forward creative.",
        priority: 5,
      };
    }
    if (lb.trustSeekingCount >= 3) {
      return {
        action: "iterate_messaging",
        reason: "Trust/proof-seeking lead signals — shift toward testimonial and case-study angles.",
        priority: 4,
      };
    }
    if (lb.handoffReadyCount >= 4) {
      return {
        action: "double_down_content",
        reason: "Many handoff-ready signals — prioritize lead capture and conversion assets.",
        priority: 4,
      };
    }
  }

  if (topTopicCount >= 2 && positiveSentimentRatio >= 0.45 && feedbackCount >= 4) {
    return {
      action: "double_down_content",
      reason: "Stored feedback shows repeatable winning topics — scale hooks and angles in those themes.",
      priority: 4,
    };
  }

  if (avg >= 0.62 && realCount >= 4) {
    return {
      action: "double_down_content",
      reason: "Strong corroborated real-world signals — lean into the top buckets in the content engine.",
      priority: 3,
    };
  }

  if (feedbackCount >= 8 && avg < 0.45) {
    return {
      action: "run_sweep",
      reason: "Stale or weak signal match — refresh market sweep with updated positioning.",
      priority: 3,
    };
  }

  return {
    action: "continue_pipeline",
    reason: "Signals within range — proceed with campaign assembly and monitor feedback.",
    priority: 1,
  };
}
