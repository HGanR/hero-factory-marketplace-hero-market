/**
 * UI-ready shapes for operator dashboard (cards, tables, boards).
 */

import type { BentleyOperatorOverview } from "@/lib/revenue-os/operator-intelligence";
import type { OperatorPlannedAction } from "@/lib/revenue-os/operator-action-planner";
import { planBentleyOperatorActions } from "@/lib/revenue-os/operator-action-planner";
import type { WorkspacePriorityRow } from "@/lib/revenue-os/workspace-prioritization";

export type OperatorDashboardUiPayload = {
  topKpiCards: Array<{ id: string; label: string; value: string; hint?: string }>;
  workspaceRankingTable: Array<{
    rank: number;
    clientId: string;
    trustId: string;
    urgencyScore: number;
    opportunityScore: number;
    combinedScore: number;
    healthScore: number;
    rationale: string;
  }>;
  urgentActionsList: OperatorPlannedAction[];
  blockedItemsList: OperatorPlannedAction[];
  leadHandoffQueue: Array<{
    clientId: string;
    trustId: string;
    openHandoffs: number;
    handoffReadyLeads: number;
  }>;
  publishReadinessBoard: Array<{
    clientId: string;
    trustId: string;
    draftCount: number;
    approvedOrScheduledCount: number;
    promotionReadyCount: number;
    failedCount: number;
  }>;
  connectorGapsBoard: Array<{
    clientId: string;
    trustId: string;
    blockedConnectorTargets: number;
    connectorAutoPublishReady: number;
    connectorPlatformsConnected: number;
  }>;
};

export function buildOperatorDashboardUiPayload(overview: BentleyOperatorOverview): OperatorDashboardUiPayload {
  const g = overview.globalSummary;
  const ranked = overview.prioritization.rankedWorkspaces;
  const wsMap = new Map(
    overview.workspaceSummaries.map((s) => [`${s.workspace.clientId}\0${s.workspace.trustId}`, s])
  );

  const topKpiCards = [
    {
      id: "health",
      label: "System health",
      value: String(overview.systemHealthScore),
      hint: "0–100 composite",
    },
    {
      id: "queue",
      label: "Queue items",
      value: String(g.totalQueueItems),
    },
    {
      id: "failures",
      label: "Failed publishes",
      value: String(g.totalFailedPublishes),
    },
    {
      id: "blocked",
      label: "Blocked targets",
      value: String(g.totalBlockedTargets),
    },
    {
      id: "handoffs",
      label: "Open handoffs",
      value: String(g.totalOpenHandoffs),
    },
    {
      id: "leads_ready",
      label: "Handoff-ready leads",
      value: String(g.totalHandoffReadyLeads),
    },
    {
      id: "unsynced",
      label: "Published (unsynced)",
      value: String(g.totalUnsyncedPublished),
    },
  ];

  const workspaceRankingTable = ranked.map((r: WorkspacePriorityRow, i: number) => {
    const s = wsMap.get(`${r.workspace.clientId}\0${r.workspace.trustId}`);
    return {
      rank: i + 1,
      clientId: r.workspace.clientId,
      trustId: r.workspace.trustId,
      urgencyScore: r.urgencyScore,
      opportunityScore: r.opportunityScore,
      combinedScore: r.combinedScore,
      healthScore: s?.healthScore ?? 0,
      rationale: r.rationale,
    };
  });

  const fullPlan = planBentleyOperatorActions({
    workspaceSummaries: overview.workspaceSummaries,
    prioritization: overview.prioritization,
  });
  const planned = overview.priorityActions.filter((a) => a.urgency === "immediate");
  const blocked = fullPlan.blockedActions;

  const leadHandoffQueue = overview.workspaceSummaries.map((s) => ({
    clientId: s.workspace.clientId,
    trustId: s.workspace.trustId,
    openHandoffs: s.openHandoffs,
    handoffReadyLeads: s.handoffReadyLeads,
  }));

  const publishReadinessBoard = overview.workspaceSummaries.map((s) => ({
    clientId: s.workspace.clientId,
    trustId: s.workspace.trustId,
    draftCount: s.draftCount,
    approvedOrScheduledCount: s.approvedOrScheduledCount,
    promotionReadyCount: s.promotionReadyCount,
    failedCount: s.failedCount,
  }));

  const connectorGapsBoard = overview.workspaceSummaries.map((s) => ({
    clientId: s.workspace.clientId,
    trustId: s.workspace.trustId,
    blockedConnectorTargets: s.blockedConnectorTargets,
    connectorAutoPublishReady: s.connectorAutoPublishReady,
    connectorPlatformsConnected: s.connectorPlatformsConnected,
  }));

  return {
    topKpiCards,
    workspaceRankingTable,
    urgentActionsList: planned.slice(0, 24),
    blockedItemsList: blocked.slice(0, 24),
    leadHandoffQueue,
    publishReadinessBoard,
    connectorGapsBoard,
  };
}
