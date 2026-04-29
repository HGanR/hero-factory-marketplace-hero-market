/**
 * Autonomous cadence planning: winners, losers, retries, stale cleanup, retests.
 */

import type { ExperimentPerformanceAnalysis } from "@/lib/revenue-os/experiment-analysis";
import type { DistributionQueueRow } from "@/lib/revenue-os/distribution-queue-actions";
import type { ConnectorCoverageSummary } from "@/lib/revenue-os/distribution-routing";
import type { LeadSignalSummary } from "@/lib/revenue-os/lead-signal-summary";
import type { GrowthGuidance, MarketIntelligenceDiff } from "@/lib/revenue-os/market-sweep-schema";
import type { WorkflowOperationalGuidance } from "@/lib/revenue-os/publishing-workflow";
import {
  connectorReadinessForQueueItem,
  extractVariantKeyFromQueueTitle,
  scoreCadencePriority,
  shouldArchiveStaleAsset,
  shouldPromoteWinner,
  shouldRetestAngle,
  shouldRetryFailedPublish,
  shouldSuppressLoser,
} from "@/lib/revenue-os/optimization-rules";
import { planBentleyRetests, type BentleyRetestRecommendation } from "@/lib/revenue-os/retest-planner";
import { buildPublishWindowHints } from "@/lib/revenue-os/publish-window-hints";

export type CadenceQueueRef = {
  queueId: string;
  title: string;
  platform: string;
  reason: string;
  kind?: "queue" | "planned_retest";
};

export type BentleyCadencePlan = {
  promoteNow: CadenceQueueRef[];
  publishNext: CadenceQueueRef[];
  retryNow: CadenceQueueRef[];
  retestNext: CadenceQueueRef[];
  suppressNow: CadenceQueueRef[];
  archiveNow: CadenceQueueRef[];
  blockedOperationally: CadenceQueueRef[];
  cadenceSummary: string;
  retestRecommendations: BentleyRetestRecommendation[];
  publishWindowHintsCount: number;
  nextSchedulerAction: string;
};

export type RunBentleyCadenceEngineInput = {
  queueItems: DistributionQueueRow[];
  experimentAnalysis: ExperimentPerformanceAnalysis | null;
  workflowOperational?: WorkflowOperationalGuidance | null;
  connectorCoverage: ConnectorCoverageSummary | null;
  leadSignalSummary?: LeadSignalSummary | null;
  intelligenceDiff?: MarketIntelligenceDiff | null;
  growthGuidance?: GrowthGuidance | null;
  platformsHint?: string[];
  /** Queue IDs that cannot auto-publish due to connector routing. */
  routingBlockedQueueIds?: ReadonlySet<string>;
  nowMs?: number;
};

function refFromQueue(q: DistributionQueueRow, reason: string): CadenceQueueRef {
  return {
    queueId: q.id,
    title: q.title,
    platform: q.platform,
    reason,
  };
}

export function runBentleyCadenceEngine(input: RunBentleyCadenceEngineInput): BentleyCadencePlan {
  const nowMs = input.nowMs ?? Date.now();
  const items = input.queueItems ?? [];
  const analysis = input.experimentAnalysis;
  const coverage = input.connectorCoverage;
  const blockedSet = input.routingBlockedQueueIds ?? new Set<string>();

  const promoteNow: CadenceQueueRef[] = [];
  const publishNext: CadenceQueueRef[] = [];
  const retryNow: CadenceQueueRef[] = [];
  const retestNext: CadenceQueueRef[] = [];
  const suppressNow: CadenceQueueRef[] = [];
  const archiveNow: CadenceQueueRef[] = [];
  const blockedOperationally: CadenceQueueRef[] = [];

  const weakConfidence =
    Boolean(analysis?.confidenceNote?.includes("Sparse") || analysis?.confidenceNote?.includes("provisional"));

  for (const q of items) {
    if (q.queueStatus === "archived") continue;

    const connectorReady = connectorReadinessForQueueItem(q, coverage);
    const routingBlocked = blockedSet.has(q.id);

    if (shouldArchiveStaleAsset({ queueItem: q, nowMs })) {
      archiveNow.push(
        refFromQueue(q, "Stale draft/schedule — archive or refresh strategy.")
      );
      continue;
    }

    if (
      shouldSuppressLoser({
        queueItem: q,
        analysis,
      })
    ) {
      suppressNow.push(
        refFromQueue(q, analysis?.recommendedNextSuppression?.slice(0, 200) ?? "Low-performing variant cell.")
      );
      continue;
    }

    if (routingBlocked && q.queueStatus !== "failed") {
      blockedOperationally.push(
        refFromQueue(q, "Connector routing blocks auto-publish — resolve OAuth or manual export.")
      );
    }

    if (
      shouldPromoteWinner({
        queueItem: q,
        analysis,
        connectorReady: connectorReady && !routingBlocked,
      })
    ) {
      promoteNow.push(
        refFromQueue(q, analysis?.recommendedNextPromotion?.slice(0, 200) ?? "Winner promotion.")
      );
    }

    if (
      shouldRetryFailedPublish({
        queueItem: q,
        connectorReady: connectorReady && !routingBlocked,
      })
    ) {
      retryNow.push(refFromQueue(q, "Retry publish while attempts remain."));
    }

    if (
      shouldRetestAngle({
        queueItem: q,
        analysis,
        weakConfidence,
      })
    ) {
      retestNext.push(refFromQueue(q, "Re-test angle after weak confidence or drift."));
    }
  }

  const scored = items
    .filter((q) => q.queueStatus === "approved" || q.queueStatus === "scheduled")
    .map((q) => {
      const vk = extractVariantKeyFromQueueTitle(q.title);
      const isWinner = Boolean(vk && analysis?.winningVariants.includes(vk));
      const isLoser = Boolean(vk && analysis?.losingVariants.includes(vk));
      const score = scoreCadencePriority({
        queueItem: q,
        isWinner,
        isLoser,
        leadSignalSummary: input.leadSignalSummary,
      });
      return { q, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 12);

  for (const { q, score } of scored) {
    publishNext.push(
      refFromQueue(q, `Next in cadence (priority score ${score}).`)
    );
  }

  const retestRecommendations = planBentleyRetests({
    experimentAnalysis: analysis,
    intelligenceDiff: input.intelligenceDiff,
    growthGuidance: input.growthGuidance,
    leadSignalSummary: input.leadSignalSummary,
    connectorCoverage: coverage,
    platformsHint: input.platformsHint ?? [],
  });

  for (const r of retestRecommendations.slice(0, 5)) {
    retestNext.push({
      queueId: "",
      title: `${r.hookType} / ${r.ctaType}`,
      platform: r.platform,
      reason: r.rationale,
      kind: "planned_retest",
    });
  }

  const windowHints = buildPublishWindowHints({
    queueItems: items,
    publishingObjective: null,
    connectorCoverage: coverage,
    experimentActive: Boolean(analysis?.winningVariants.length),
  });

  const wf = input.workflowOperational?.workflowSummary ?? "";
  let nextSchedulerAction = "Review cadence buckets and approve promoted assets.";
  if (promoteNow.length) {
    nextSchedulerAction = `Promote ${promoteNow.length} winning asset(s) for immediate scheduling.`;
  } else if (retryNow.length) {
    nextSchedulerAction = `Retry ${retryNow.length} failed publish(es) with connector fixes.`;
  } else if (archiveNow.length) {
    nextSchedulerAction = `Clean up ${archiveNow.length} stale queue row(s) — archive or refresh.`;
  } else if (retestRecommendations.length) {
    nextSchedulerAction = retestRecommendations[0]?.rationale.slice(0, 200) ?? nextSchedulerAction;
  } else if (wf) {
    nextSchedulerAction = wf.slice(0, 200);
  }

  const cadenceSummary = [
    promoteNow.length ? `${promoteNow.length} winning asset(s) promoted for publishing.` : "",
    suppressNow.length ? `${suppressNow.length} low-performing asset(s) suppressed pending retest.` : "",
    retryNow.length ? `${retryNow.length} failed post(s) retry-ready.` : "",
    archiveNow.length ? `${archiveNow.length} stale asset(s) should archive or refresh.` : "",
    retestRecommendations.length
      ? `${retestRecommendations.length} retest idea(s) from planner.`
      : "",
    blockedOperationally.length ? `${blockedOperationally.length} item(s) blocked operationally (connectors).` : "",
  ]
    .filter(Boolean)
    .join(" ")
    .slice(0, 2000);

  return {
    promoteNow,
    publishNext,
    retryNow,
    retestNext,
    suppressNow,
    archiveNow,
    blockedOperationally,
    cadenceSummary: cadenceSummary || "Queue is clear — no cadence actions required.",
    retestRecommendations,
    publishWindowHintsCount: windowHints.length,
    nextSchedulerAction,
  };
}
