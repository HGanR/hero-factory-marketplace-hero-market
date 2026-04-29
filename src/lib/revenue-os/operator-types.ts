/**
 * Shared types for operator command center (multi-workspace).
 */

import type { OperatorWorkspaceKey } from "@/lib/revenue-os/operator-workspaces";
import type { BentleyCadencePlan } from "@/lib/revenue-os/cadence-engine";

export type OperatorWorkspaceSummary = {
  workspace: OperatorWorkspaceKey;
  queueTotal: number;
  draftCount: number;
  failedCount: number;
  approvedOrScheduledCount: number;
  publishedUnsyncedCount: number;
  archivedCount: number;
  blockedConnectorTargets: number;
  promotionReadyCount: number;
  suppressedAssetCount: number;
  staleBacklogCount: number;
  activeExperimentIds: string[];
  openHandoffs: number;
  handoffReadyLeads: number;
  leadSignalTotal: number;
  connectorPlatformsConnected: number;
  connectorAutoPublishReady: number;
  cadenceSummary: string | null;
  cadencePlan: BentleyCadencePlan | null;
  lastCadenceRunAt: string | null;
  healthScore: number;
};

export type BentleyOperatorGlobalSummary = {
  workspaceCount: number;
  totalQueueItems: number;
  totalFailedPublishes: number;
  totalBlockedTargets: number;
  totalOpenHandoffs: number;
  totalHandoffReadyLeads: number;
  totalUnsyncedPublished: number;
};
