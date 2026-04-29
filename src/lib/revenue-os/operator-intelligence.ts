/**
 * Multi-workspace operator overview — aggregates queue, connectors, cadence, leads, handoffs.
 */

import type { GrowthGuidance } from "@/lib/revenue-os/market-sweep-schema";
import { analyzeExperimentPerformance } from "@/lib/revenue-os/experiment-analysis";
import { getExperimentPerformanceSummary } from "@/lib/revenue-os/experiment-results";
import {
  fetchDistributionQueueState,
  fetchDistributionQueueTargetsForQueues,
} from "@/lib/revenue-os/distribution-queue-actions";
import { routeDistributionTargets } from "@/lib/revenue-os/distribution-routing";
import {
  getConnectedPublishingProfiles,
  getPublishingCapabilityMatrix,
} from "@/lib/revenue-os/platform-connectors";
import { runBentleyCadenceEngine, type BentleyCadencePlan } from "@/lib/revenue-os/cadence-engine";
import { fetchLatestCadenceRun } from "@/lib/revenue-os/persist-cadence-actions";
import { getLeadSignalSummary } from "@/lib/revenue-os/lead-signal-summary";
import { fetchLeadHandoffSummary } from "@/lib/revenue-os/lead-handoff";
import { shouldArchiveStaleAsset } from "@/lib/revenue-os/optimization-rules";
import type { OperatorWorkspaceKey, DiscoverOperatorWorkspacesParams } from "@/lib/revenue-os/operator-workspaces";
import { discoverOperatorWorkspaces } from "@/lib/revenue-os/operator-workspaces";
import { planBentleyOperatorActions, type OperatorPlannedAction } from "@/lib/revenue-os/operator-action-planner";
import {
  prioritizeBentleyWorkspaces,
  type WorkspacePrioritizationResult,
} from "@/lib/revenue-os/workspace-prioritization";
import type {
  OperatorWorkspaceSummary,
  BentleyOperatorGlobalSummary,
} from "@/lib/revenue-os/operator-types";

export type { OperatorWorkspaceSummary, BentleyOperatorGlobalSummary } from "@/lib/revenue-os/operator-types";

export type BentleyOperatorOverview = {
  generatedAt: string;
  userId: string;
  workspaceSummaries: OperatorWorkspaceSummary[];
  globalSummary: BentleyOperatorGlobalSummary;
  priorityActions: OperatorPlannedAction[];
  riskFlags: string[];
  recommendedFocus: string;
  systemHealthScore: number;
  prioritization: WorkspacePrioritizationResult;
};

function workspaceHealthScore(s: Omit<OperatorWorkspaceSummary, "workspace" | "cadencePlan">): number {
  let score = 72;
  score -= Math.min(30, s.failedCount * 6);
  score -= Math.min(20, s.blockedConnectorTargets * 2);
  score -= Math.min(15, s.staleBacklogCount * 3);
  score -= Math.min(15, s.openHandoffs * 2);
  score += Math.min(10, s.promotionReadyCount * 2);
  return Math.max(0, Math.min(100, Math.round(score)));
}

async function buildWorkspaceSummary(params: {
  userId: string;
  workspace: OperatorWorkspaceKey;
  nowMs: number;
}): Promise<OperatorWorkspaceSummary> {
  const { userId, workspace, nowMs } = params;
  const clientId = workspace.clientId ?? "";
  const trustId = workspace.trustId ?? "";

  const queueItems = await fetchDistributionQueueState({
    userId,
    clientId,
    trustId,
    limit: 200,
  });

  let draftCount = 0;
  let failedCount = 0;
  let approvedOrScheduledCount = 0;
  let publishedUnsyncedCount = 0;
  let archivedCount = 0;
  let suppressedAssetCount = 0;
  let staleBacklogCount = 0;
  const experimentIds = new Set<string>();

  for (const q of queueItems) {
    if (q.experimentId) experimentIds.add(q.experimentId);
    if (q.queueStatus === "draft") draftCount++;
    if (q.queueStatus === "failed") failedCount++;
    if (q.queueStatus === "approved" || q.queueStatus === "scheduled") approvedOrScheduledCount++;
    if (
      q.queueStatus === "published" &&
      q.performanceSyncStatus !== "synced" &&
      q.lastSyncedAt == null
    ) {
      publishedUnsyncedCount++;
    }
    if (q.queueStatus === "archived") archivedCount++;
    if (q.suppressionReason?.trim()) suppressedAssetCount++;
    if (shouldArchiveStaleAsset({ queueItem: q, nowMs })) staleBacklogCount++;
  }

  const targets = await fetchDistributionQueueTargetsForQueues({
    queueIds: queueItems.map((q) => q.id),
  });

  let blockedConnectorTargets = 0;
  let connectorPlatformsConnected = 0;
  let connectorAutoPublishReady = 0;
  let cadencePlan: BentleyCadencePlan | null = null;
  let cadenceSummary: string | null = null;

  try {
    const profiles = await getConnectedPublishingProfiles({ userId, clientId });
    const matrix = getPublishingCapabilityMatrix(profiles);
    connectorPlatformsConnected = matrix.connectedPlatforms.length;
    connectorAutoPublishReady = matrix.platformsWithAutoPublish.length;
    const routing = routeDistributionTargets({
      distributionPlan: null,
      connectedProfiles: profiles,
      capabilityMatrix: matrix,
      queueItems,
      targets,
      publishingObjective: null,
    });
    for (const rt of routing.routedTargets) {
      if (
        rt.routingStatus === "blocked_no_connector" ||
        rt.routingStatus === "blocked_capability_mismatch"
      ) {
        blockedConnectorTargets++;
      }
    }

    let experimentAnalysis = null;
    const expList = [...experimentIds];
    if (expList.length) {
      const summary = await getExperimentPerformanceSummary(expList[0]);
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

    const leadSummary = await getLeadSignalSummary({ userId, clientId, trustId });
    cadencePlan = runBentleyCadenceEngine({
      queueItems,
      experimentAnalysis,
      connectorCoverage: routing.connectorCoverageSummary,
      leadSignalSummary: leadSummary.totalSignals > 0 ? leadSummary : null,
      platformsHint: [],
      routingBlockedQueueIds: new Set(
        routing.routedTargets
          .filter(
            (r) =>
              r.routingStatus === "blocked_no_connector" ||
              r.routingStatus === "blocked_capability_mismatch"
          )
          .map((r) => r.queueId)
      ),
    });
    cadenceSummary = cadencePlan.cadenceSummary;
  } catch (e) {
    console.warn("[operator-intelligence] workspace aggregate partial failure", e);
  }

  const leadSig = await getLeadSignalSummary({ userId, clientId, trustId });
  const handSummary = await fetchLeadHandoffSummary({ userId, clientId, trustId });
  const cadenceRun = await fetchLatestCadenceRun({ userId, clientId, trustId });

  const promotionReadyCount = cadencePlan?.promoteNow.length ?? 0;

  const base = {
    queueTotal: queueItems.length,
    draftCount,
    failedCount,
    approvedOrScheduledCount,
    publishedUnsyncedCount,
    archivedCount,
    blockedConnectorTargets,
    promotionReadyCount,
    suppressedAssetCount,
    staleBacklogCount,
    activeExperimentIds: [...experimentIds],
    openHandoffs: handSummary.totalOpen,
    handoffReadyLeads: leadSig.handoffReadyLeads,
    leadSignalTotal: leadSig.totalSignals,
    connectorPlatformsConnected,
    connectorAutoPublishReady,
    cadenceSummary,
    cadencePlan,
    lastCadenceRunAt: cadenceRun?.startedAt
      ? cadenceRun.startedAt instanceof Date
        ? cadenceRun.startedAt.toISOString()
        : String(cadenceRun.startedAt)
      : null,
  };

  const healthScore = workspaceHealthScore(base);

  return {
    workspace,
    ...base,
    healthScore,
  };
}

export type BuildBentleyOperatorOverviewInput = DiscoverOperatorWorkspacesParams & {
  /** When empty, workspaces are discovered automatically. */
  workspaces?: OperatorWorkspaceKey[] | null;
  dateWindow?: { startMs?: number; endMs?: number };
};

export async function buildBentleyOperatorOverview(
  input: BuildBentleyOperatorOverviewInput
): Promise<BentleyOperatorOverview> {
  const userId = String(input.userId).trim();
  const nowMs = input.dateWindow?.endMs ?? Date.now();

  const workspaces =
    input.workspaces?.length ? input.workspaces : await discoverOperatorWorkspaces(input);

  const workspaceSummaries: OperatorWorkspaceSummary[] = [];
  for (const w of workspaces) {
    try {
      workspaceSummaries.push(await buildWorkspaceSummary({ userId, workspace: w, nowMs }));
    } catch (e) {
      console.warn("[operator-intelligence] workspace skipped", e);
    }
  }

  const globalSummary: BentleyOperatorGlobalSummary = {
    workspaceCount: workspaceSummaries.length,
    totalQueueItems: workspaceSummaries.reduce((a, s) => a + s.queueTotal, 0),
    totalFailedPublishes: workspaceSummaries.reduce((a, s) => a + s.failedCount, 0),
    totalBlockedTargets: workspaceSummaries.reduce((a, s) => a + s.blockedConnectorTargets, 0),
    totalOpenHandoffs: workspaceSummaries.reduce((a, s) => a + s.openHandoffs, 0),
    totalHandoffReadyLeads: workspaceSummaries.reduce((a, s) => a + s.handoffReadyLeads, 0),
    totalUnsyncedPublished: workspaceSummaries.reduce((a, s) => a + s.publishedUnsyncedCount, 0),
  };

  const prioritization = prioritizeBentleyWorkspaces({ workspaceSummaries });
  const planned = planBentleyOperatorActions({
    workspaceSummaries,
    prioritization,
  });

  const riskFlags: string[] = [];
  if (globalSummary.totalFailedPublishes > 0) {
    riskFlags.push(`${globalSummary.totalFailedPublishes} failed publish(es) across workspaces.`);
  }
  if (globalSummary.totalBlockedTargets > 0) {
    riskFlags.push(`${globalSummary.totalBlockedTargets} connector-blocked target(s).`);
  }
  if (globalSummary.totalOpenHandoffs > 3) {
    riskFlags.push(`${globalSummary.totalOpenHandoffs} open lead handoff(s) need routing.`);
  }

  let systemHealthScore = 70;
  systemHealthScore -= Math.min(25, globalSummary.totalFailedPublishes * 4);
  systemHealthScore -= Math.min(15, globalSummary.totalBlockedTargets);
  systemHealthScore -= Math.min(15, globalSummary.totalOpenHandoffs * 2);
  systemHealthScore = Math.max(0, Math.min(100, Math.round(systemHealthScore)));

  let recommendedFocus = "Monitor queue cadence and connector coverage per workspace.";
  if (!workspaceSummaries.length) {
    recommendedFocus = "No workspaces in scope — add distribution activity or broaden filters.";
  } else if (prioritization.topUrgentWorkspace) {
    recommendedFocus = `Focus first on workspace client ${prioritization.topUrgentWorkspace.workspace.clientId} — highest urgency score.`;
  } else if (prioritization.topOpportunityWorkspace) {
    recommendedFocus = `Opportunity: workspace client ${prioritization.topOpportunityWorkspace.workspace.clientId} — promote winners and clear backlog.`;
  }

  return {
    generatedAt: new Date(nowMs).toISOString(),
    userId,
    workspaceSummaries,
    globalSummary,
    priorityActions: planned.immediateActions.concat(planned.todayActions).slice(0, 24),
    riskFlags,
    recommendedFocus,
    systemHealthScore,
    prioritization,
  };
}

/** Merge operator overview into growth guidance (optional enrichment). */
export function mergeOperatorOverviewIntoGrowthGuidance(
  base: GrowthGuidance,
  overview: BentleyOperatorOverview
): GrowthGuidance {
  const p = overview.prioritization;
  const g = overview.globalSummary;
  return {
    ...base,
    systemHealthScore: overview.systemHealthScore,
    topUrgentWorkspace: p.topUrgentWorkspace
      ? `${p.topUrgentWorkspace.workspace.clientId}/${p.topUrgentWorkspace.workspace.trustId}`
      : undefined,
    topOpportunityWorkspace: p.topOpportunityWorkspace
      ? `${p.topOpportunityWorkspace.workspace.clientId}/${p.topOpportunityWorkspace.workspace.trustId}`
      : undefined,
    operatorActionSummary: overview.priorityActions
      .slice(0, 5)
      .map((a) => a.reason)
      .join(" | ")
      .slice(0, 1200),
    leadHandoffBacklogSummary:
      g.totalOpenHandoffs > 0
        ? `${g.totalOpenHandoffs} open handoff(s); ${g.totalHandoffReadyLeads} handoff-ready lead(s) across workspaces.`
        : undefined,
    connectorGapSummary:
      g.totalBlockedTargets > 0
        ? `${g.totalBlockedTargets} blocked connector target(s) — connect OAuth or manual export.`
        : undefined,
    publishFailureSummary:
      g.totalFailedPublishes > 0
        ? `${g.totalFailedPublishes} failed publish(es); retry or revise creative.`
        : undefined,
  };
}

/** Valid empty overview (no workspaces / signed-out placeholder). */
export function buildEmptyOperatorOverview(userId: string): BentleyOperatorOverview {
  const workspaceSummaries: OperatorWorkspaceSummary[] = [];
  const globalSummary: BentleyOperatorGlobalSummary = {
    workspaceCount: 0,
    totalQueueItems: 0,
    totalFailedPublishes: 0,
    totalBlockedTargets: 0,
    totalOpenHandoffs: 0,
    totalHandoffReadyLeads: 0,
    totalUnsyncedPublished: 0,
  };
  const prioritization = prioritizeBentleyWorkspaces({ workspaceSummaries });
  const planned = planBentleyOperatorActions({ workspaceSummaries, prioritization });
  return {
    generatedAt: new Date().toISOString(),
    userId,
    workspaceSummaries,
    globalSummary,
    priorityActions: planned.immediateActions.concat(planned.todayActions).slice(0, 24),
    riskFlags: [],
    recommendedFocus: "No workspaces in scope — connect data or add distribution queue items.",
    systemHealthScore: 100,
    prioritization,
  };
}
