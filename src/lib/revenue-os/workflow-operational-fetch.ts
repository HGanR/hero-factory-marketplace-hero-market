/**
 * Loads queue + handoff state and builds publishing workflow + guidance lines for UI / notes.
 */

import {
  fetchDistributionQueueState,
  fetchDistributionQueueTargetsForQueues,
} from "@/lib/revenue-os/distribution-queue-actions";
import {
  buildPublishingWorkflow,
  buildWorkflowOperationalGuidance,
  type PublishingWorkflowResult,
  type WorkflowOperationalGuidance,
} from "@/lib/revenue-os/publishing-workflow";
import { countOpenHandoffs } from "@/lib/revenue-os/lead-handoff";
import type { BentleyDistributionPlan } from "@/lib/revenue-os/market-sweep-schema";
import type { LeadSignalSummary } from "@/lib/revenue-os/lead-signal-summary";
import type { GrowthGuidance, MarketIntelligenceDiff, MarketSweepResult } from "@/lib/revenue-os/market-sweep-schema";
import { routeDistributionTargets } from "@/lib/revenue-os/distribution-routing";
import {
  getConnectedPublishingProfiles,
  getPublishingCapabilityMatrix,
} from "@/lib/revenue-os/platform-connectors";
import { persistDistributionRouting } from "@/lib/revenue-os/persist-distribution-routing";
import type { ConnectorCoverageSummary } from "@/lib/revenue-os/distribution-routing";
import { analyzeExperimentPerformance } from "@/lib/revenue-os/experiment-analysis";
import { getExperimentPerformanceSummary } from "@/lib/revenue-os/experiment-results";
import { runBentleyCadenceEngine, type BentleyCadencePlan } from "@/lib/revenue-os/cadence-engine";

export type PublishingWorkflowOperationalSnapshot = {
  workflow: PublishingWorkflowResult;
  guidance: WorkflowOperationalGuidance;
  queueItemCount: number;
  cadencePlan?: BentleyCadencePlan | null;
};

export async function fetchPublishingWorkflowOperationalSnapshot(params: {
  userId: string;
  clientId: string;
  trustId: string;
  distributionPlan?: BentleyDistributionPlan | null;
  leadSignalSummary?: LeadSignalSummary | null;
  publishingObjective?: string | null;
  intelligenceDiff?: MarketIntelligenceDiff | null;
  growthGuidance?: GrowthGuidance | null;
  /** When false, skip persisting routing onto targets (read-only dashboards). Default true. */
  persistRouting?: boolean;
}): Promise<PublishingWorkflowOperationalSnapshot> {
  const queueItems = await fetchDistributionQueueState({
    userId: params.userId,
    clientId: params.clientId,
    trustId: params.trustId,
    limit: 120,
  });
  const open = await countOpenHandoffs({
    userId: params.userId,
    clientId: params.clientId,
    trustId: params.trustId,
  });

  let connectorCoverageSummary: ConnectorCoverageSummary | null = null;
  let cadencePlan: BentleyCadencePlan | null = null;
  const routingBlockedQueueIds = new Set<string>();
  try {
    const profiles = await getConnectedPublishingProfiles({
      userId: params.userId,
      clientId: params.clientId,
    });
    const matrix = getPublishingCapabilityMatrix(profiles);
    const queueIds = queueItems.map((q) => q.id);
    const targets = await fetchDistributionQueueTargetsForQueues({ queueIds });
    const routing = routeDistributionTargets({
      distributionPlan: params.distributionPlan ?? null,
      connectedProfiles: profiles,
      capabilityMatrix: matrix,
      queueItems,
      targets,
      targetPlatformHints: params.distributionPlan?.platformFormatHints,
      publishingObjective: params.publishingObjective ?? null,
    });
    if (params.persistRouting !== false) {
      await persistDistributionRouting({ routedTargets: routing.routedTargets });
    }
    connectorCoverageSummary = routing.connectorCoverageSummary;
    for (const rt of routing.routedTargets) {
      if (
        rt.routingStatus === "blocked_no_connector" ||
        rt.routingStatus === "blocked_capability_mismatch"
      ) {
        routingBlockedQueueIds.add(rt.queueId);
      }
    }
  } catch (e) {
    console.warn("[workflow-operational-fetch] connector routing skipped", e);
  }

  try {
    const expIds = [...new Set(queueItems.map((q) => q.experimentId).filter(Boolean))] as string[];
    let experimentAnalysis = null;
    if (expIds.length) {
      const summary = await getExperimentPerformanceSummary(expIds[0]);
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
    }
    cadencePlan = runBentleyCadenceEngine({
      queueItems,
      experimentAnalysis,
      connectorCoverage: connectorCoverageSummary,
      leadSignalSummary: params.leadSignalSummary ?? null,
      intelligenceDiff: params.intelligenceDiff ?? undefined,
      growthGuidance: params.growthGuidance ?? undefined,
      platformsHint: params.distributionPlan?.platformFormatHints?.map((h) => h.platform) ?? [],
      routingBlockedQueueIds,
    });
  } catch (e) {
    console.warn("[workflow-operational-fetch] cadence engine skipped", e);
  }

  const workflow = buildPublishingWorkflow({
    distributionPlan: params.distributionPlan ?? null,
    queueItems,
    platformFormatHints: params.distributionPlan?.platformFormatHints,
    leadSignalSummary: params.leadSignalSummary ?? null,
    approvalsRequired: true,
    cadencePlan,
  });

  const guidance = buildWorkflowOperationalGuidance({
    workflow,
    handoffOpenCount: open,
    connectorCoverageSummary: connectorCoverageSummary ?? null,
    cadencePlan,
  });

  return {
    workflow,
    guidance,
    queueItemCount: queueItems.length,
    cadencePlan,
  };
}

/**
 * Enriches sweep `growthGuidance` with publishing + handoff operational lines (no-op when unauthenticated).
 */
export async function mergePublishingWorkflowIntoSweepResult(params: {
  result: MarketSweepResult;
  userId: string | null;
  clientId: string;
  trustId: string;
}): Promise<MarketSweepResult> {
  const { result, userId, clientId, trustId } = params;
  if (!userId || !result.growthGuidance) return result;
  try {
    const snap = await fetchPublishingWorkflowOperationalSnapshot({
      userId: String(userId),
      clientId,
      trustId,
      distributionPlan: result.distributionPlan ?? null,
      leadSignalSummary: result.leadSignalSummary ?? null,
      publishingObjective: null,
      intelligenceDiff: result.intelligenceDiff ?? null,
      growthGuidance: result.growthGuidance ?? null,
    });
    const g = result.growthGuidance;
    const w = snap.guidance.workflowSummary ?? "";
    const cc = snap.guidance.connectorCoverageSummary;
    const connectorLine = snap.guidance.connectorSummaryLine ?? "";
    return {
      ...result,
      growthGuidance: {
        ...g,
        workflowSummary: snap.guidance.workflowSummary,
        approvalBottleneckLine: snap.guidance.approvalBottleneckLine,
        publishFailureLine: snap.guidance.publishFailureLine,
        unsyncedMetricLine: snap.guidance.unsyncedMetricLine,
        handoffBacklogLine: snap.guidance.handoffBacklogLine,
        bentleyOperationalNextStep: snap.guidance.bentleyOperationalNextStep,
        connectorCoverageSummary: connectorLine || cc?.matrixSummaryLine,
        autoPublishReadyCount: cc?.autoPublishReadyCount,
        manualFallbackCount: cc?.manualFallbackCount,
        blockedTargetsCount: cc?.blockedTargetsCount,
        recommendedConnectorAction: cc?.recommendedConnectorAction,
        cadenceSummary: snap.guidance.cadenceSummary,
        cadencePromotionCount: snap.guidance.cadencePromotionCount,
        cadenceSuppressionCount: snap.guidance.cadenceSuppressionCount,
        cadenceRetryCount: snap.guidance.cadenceRetryCount,
        cadenceStaleCount: snap.guidance.cadenceStaleCount,
        cadenceRetestRecommendationCount: snap.guidance.cadenceRetestRecommendationCount,
        cadenceNextSchedulerAction: snap.guidance.cadenceNextAction,
        why: [g.why, w, connectorLine, snap.guidance.cadenceSummary].filter(Boolean).join(" ").trim().slice(0, 4500),
      },
    };
  } catch {
    return result;
  }
}
