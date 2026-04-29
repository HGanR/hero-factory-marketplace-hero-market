import type { RealSignalBundle } from "@/lib/revenue-os/market-signals/types";
import type { FeedbackAggregationResult } from "@/lib/revenue-os/feedback-aggregation";
import type { MarketSweepResult } from "@/lib/revenue-os/market-sweep-schema";
import type { LeadSignalSummary } from "@/lib/revenue-os/lead-signal-summary";
import type { ExperimentPerformanceAnalysis } from "@/lib/revenue-os/experiment-analysis";
import { planBentleyExperiment } from "@/lib/revenue-os/experiment-planner";
import { persistDraftExperimentPlan } from "@/lib/revenue-os/experiment-persist";
import { persistMarketIntelligenceSnapshot } from "@/lib/revenue-os/persist-market-intelligence";
import { analyzeExperimentPerformance } from "@/lib/revenue-os/experiment-analysis";
import { getExperimentPerformanceSummary } from "@/lib/revenue-os/experiment-results";
import { planBentleyDistribution } from "@/lib/revenue-os/distribution-planner";
import { persistDraftDistributionQueue } from "@/lib/revenue-os/persist-distribution-queue";

export type EnrichMarketSweepExperimentsParams = {
  hybrid: MarketSweepResult;
  feedback: FeedbackAggregationResult;
  platforms: string[];
  industry: string;
  targetAudience: string;
  clientId: string;
  trustId: string;
  userId: string | null;
  fingerprint: string;
  bundle: RealSignalBundle;
  /** When present (typically authed workspace with signals), attached to API result. */
  leadSignalSummary?: LeadSignalSummary | null;
};

/**
 * Attaches experiment plan + distribution plan to sweep result; persists snapshot + draft experiment + draft distribution when authed.
 * Never throws — persistence failures only log.
 */
export async function enrichMarketSweepWithExperiments(
  params: EnrichMarketSweepExperimentsParams
): Promise<MarketSweepResult> {
  const h = params.hybrid;
  const leadSignalSummary = params.leadSignalSummary ?? null;

  if (!h.nextAction || !h.contentGenerationMode || !h.growthGuidance) {
    return {
      ...h,
      experimentPlan: null,
      experimentPlanSkippedReason: "Incomplete sweep output — cannot plan experiments.",
      leadSignalSummary,
    };
  }

  const planOut = planBentleyExperiment({
    nextAction: h.nextAction,
    contentGenerationMode: h.contentGenerationMode,
    growthGuidance: h.growthGuidance,
    topPerformingTopics: params.feedback.topPerformingTopics,
    underperformingTopics: params.feedback.underperformingTopics,
    topPerformingHookTypes: params.feedback.topPerformingHookTypes,
    marketIntelligenceDiff: h.intelligenceDiff ?? null,
    hybrid: h,
    defaultPlatforms: params.platforms,
  });

  let out: MarketSweepResult = {
    ...h,
    experimentPlan: planOut.plan,
    experimentPlanSkippedReason: planOut.plan ? undefined : planOut.skippedReason,
    leadSignalSummary,
  };

  let snapshotId: string | null = null;
  let experimentId: string | null = null;
  let variantIdsByKey: Record<string, string> | null = null;

  if (params.userId) {
    try {
      snapshotId = await persistMarketIntelligenceSnapshot({
        userId: String(params.userId),
        clientId: params.clientId,
        trustId: params.trustId,
        industry: params.industry,
        targetAudience: params.targetAudience,
        queryFingerprint: params.fingerprint,
        realSignals: params.bundle,
        mergedResult: out,
        scoredSignals: out.scoredInsights ?? null,
        decisionHint: out.nextAction?.action ?? null,
      });

      if (planOut.plan) {
        const persisted = await persistDraftExperimentPlan({
          userId: String(params.userId),
          clientId: params.clientId,
          trustId: params.trustId,
          marketSweepSnapshotId: snapshotId,
          nextActionType: h.nextAction.action,
          contentGenerationMode: h.contentGenerationMode,
          plan: planOut.plan,
        });
        if (persisted) {
          experimentId = persisted.experimentId;
          variantIdsByKey = persisted.variantIdsByKey;
          out = {
            ...out,
            experimentPlan: {
              ...planOut.plan,
              experimentId: persisted.experimentId,
              variantIdsByKey: persisted.variantIdsByKey,
            },
          };
        }
      }
    } catch (e) {
      console.error("[market-sweep-experiment-bundle] persist failed", e);
    }
  }

  let experimentAnalysis: ExperimentPerformanceAnalysis | null = null;
  if (experimentId) {
    try {
      const summary = await getExperimentPerformanceSummary(experimentId);
      if (summary?.variants.length) {
        experimentAnalysis = analyzeExperimentPerformance({
          variants: summary.variants.map((v) => ({
            variantKey: v.variantKey,
            hookType: v.hookType,
            angle: v.angle,
            ctaType: v.ctaType,
            score: v.score,
            views: v.views,
            leads: v.leads,
          })),
          experimentTheme: summary.experimentTheme,
        });
      }
    } catch (e) {
      console.warn("[market-sweep-experiment-bundle] experiment analysis failed", e);
    }
  }

  if (planOut.plan && out.nextAction && out.contentGenerationMode && out.growthGuidance) {
    const dist = planBentleyDistribution({
      experimentPlan: out.experimentPlan ?? planOut.plan,
      experimentAnalysis,
      nextAction: out.nextAction,
      contentGenerationMode: out.contentGenerationMode,
      growthGuidance: out.growthGuidance,
      winningVariants: experimentAnalysis?.winningVariants ?? [],
      recommendedPlatforms: planOut.plan?.recommendedPlatforms ?? params.platforms,
      topPerformingHookTypes: params.feedback.topPerformingHookTypes,
    });
    out = {
      ...out,
      distributionPlan: dist,
      growthGuidance: out.growthGuidance
        ? {
            ...out.growthGuidance,
            distributionPlanSummary: dist.summary.slice(0, 1200),
          }
        : out.growthGuidance,
    };

    if (params.userId && snapshotId && (dist.launchNow.length > 0 || dist.testNext.length > 0)) {
      try {
        await persistDraftDistributionQueue({
          userId: String(params.userId),
          clientId: params.clientId,
          trustId: params.trustId,
          marketSweepSnapshotId: snapshotId,
          experimentId,
          variantIdsByKey,
          launchNow: dist.launchNow,
          testNext: dist.testNext,
        });
      } catch (e) {
        console.error("[market-sweep-experiment-bundle] distribution persist failed", e);
      }
    }
  }

  return out;
}
