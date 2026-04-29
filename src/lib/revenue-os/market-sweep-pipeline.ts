/**
 * Server-only: real signal fetch → LLM or deterministic buckets → hybrid finalize.
 */

import { finalizeMarketSweepHybrid } from "@/lib/revenue-os/market-sweep-finalize";
import {
  buildDeterministicMarketSweepParsed,
  synthesizeMarketSweepWithLlm,
} from "@/lib/revenue-os/market-sweep-synthesize";
import type { MarketSweepResult } from "@/lib/revenue-os/market-sweep-schema";
import { fetchFeedbackAggregationForSweep } from "@/lib/revenue-os/feedback-aggregation";
import { fingerprintMarketSweepQuery, fetchLatestMarketSweepSnapshot } from "@/lib/revenue-os/persist-market-intelligence";
import { aggregateRealMarketSignals } from "@/lib/revenue-os/market-signals/aggregateRealSignals";
import { youtubeConnector } from "@/lib/revenue-os/market-signals/youtubeConnector";
import type { MarketSignalFetchParams } from "@/lib/revenue-os/market-signals/types";

export type RunMarketIntelligenceSweepParams = {
  industry: string;
  targetAudience: string;
  platforms: string[];
  clientId: string;
  trustId: string;
  userId: string | null;
};

function bucketLineCount(m: MarketSweepResult): number {
  return (
    (m.trendingTopics?.length ?? 0) +
    (m.viralHooks?.length ?? 0) +
    (m.painPoints?.length ?? 0) +
    (m.commentInsights?.length ?? 0)
  );
}

function assertUsableSweep(m: MarketSweepResult): void {
  if (bucketLineCount(m) < 2) {
    throw new Error("MARKET_SWEEP_EMPTY_OUTPUT: insufficient bucket lines after synthesis");
  }
}

/**
 * End-to-end sweep used by POST /api/revenue-os/market-sweep.
 */
export async function runMarketIntelligenceSweepPipeline(params: RunMarketIntelligenceSweepParams): Promise<{
  result: MarketSweepResult;
  connectedIntegrations: string[];
  llmUsed: boolean;
  llmError?: string;
}> {
  const industry = params.industry.trim();
  const targetAudience = params.targetAudience.trim() || "general audience";
  const platforms = Array.isArray(params.platforms) ? params.platforms.map((p) => String(p).trim()).filter(Boolean) : [];

  const fetchParams: MarketSignalFetchParams = {
    industry,
    targetAudience,
    platforms,
  };

  const bundle = await aggregateRealMarketSignals(fetchParams);

  const synthInput = { industry, targetAudience, platforms, bundle };

  let parsed: MarketSweepResult;
  let llmUsed = false;
  let llmError: string | undefined;

  const llm = await synthesizeMarketSweepWithLlm(synthInput);
  if (llm.ok) {
    parsed = llm.parsed;
    llmUsed = true;
  } else {
    llmError = llm.error;
    console.warn("[market-sweep] LLM synthesis unavailable, using deterministic buckets:", llm.error);
    parsed = buildDeterministicMarketSweepParsed(synthInput);
  }

  assertUsableSweep(parsed);

  const feedback = await fetchFeedbackAggregationForSweep({
    userId: params.userId,
    clientId: params.clientId,
    trustId: params.trustId,
  });

  const fp = fingerprintMarketSweepQuery(industry, targetAudience, platforms);
  let prior: MarketSweepResult | null = null;
  if (params.userId?.trim()) {
    try {
      prior = await fetchLatestMarketSweepSnapshot({
        userId: params.userId.trim(),
        clientId: params.clientId,
        trustId: params.trustId,
        queryFingerprint: fp,
      });
    } catch (e) {
      console.warn("[market-sweep] prior snapshot load failed", e);
    }
  }

  const result = finalizeMarketSweepHybrid({
    parsed,
    bundle,
    feedback,
    priorSnapshot: prior,
  });

  assertUsableSweep(result);

  const connectedIntegrations: string[] = ["reddit"];
  if (youtubeConnector.isConfigured()) {
    connectedIntegrations.push("youtube");
  }

  return {
    result,
    connectedIntegrations,
    llmUsed,
    ...(llmError ? { llmError } : {}),
  };
}
