/**
 * Normalized operational snapshots for rollout monitoring (from existing operator overview).
 */

import type { BentleyOperatorOverview } from "@/lib/revenue-os/operator-intelligence";
import { detectBentleyExceptions } from "@/lib/revenue-os/exception-detection";

export type BentleyRolloutObservation = {
  failedPublishTotal: number;
  blockedTargetsTotal: number;
  unsyncedPublishedTotal: number;
  openHandoffsTotal: number;
  handoffReadyLeadsTotal: number;
  queueDraftStaleTotal: number;
  promotionReadyTotal: number;
  suppressedAssetTotal: number;
  cadenceStaleWorkspaceCount: number;
  criticalExceptionCount: number;
  warningExceptionCount: number;
  systemHealthScore: number;
  workspaceCount: number;
  /** Approximate aggregate signal for approval pressure (queue items pending approval). */
  approvalPressureScore: number;
  generatedAt: string;
};

function sumWorkspace(s: BentleyOperatorOverview["workspaceSummaries"][0], key: keyof typeof s): number {
  const v = s[key];
  return typeof v === "number" ? v : 0;
}

/**
 * Collects a single snapshot from `buildBentleyOperatorOverview` output. Pure.
 */
export function collectBentleyRolloutObservation(input: { overview: BentleyOperatorOverview }): BentleyRolloutObservation {
  const o = input.overview;
  const g = o.globalSummary;
  const ws = o.workspaceSummaries;

  let queueDraftStale = 0;
  let promotionReady = 0;
  let suppressed = 0;
  let cadenceStale = 0;
  let approvalPressure = 0;

  for (const s of ws) {
    queueDraftStale += s.draftCount + s.staleBacklogCount;
    promotionReady += s.promotionReadyCount;
    suppressed += s.suppressedAssetCount;
    if (s.cadencePlan && !s.lastCadenceRunAt && s.queueTotal > 0) cadenceStale++;
    approvalPressure += s.approvedOrScheduledCount > 30 ? 2 : s.approvedOrScheduledCount > 15 ? 1 : 0;
  }

  const ex = detectBentleyExceptions({ overview: o });

  return {
    failedPublishTotal: g.totalFailedPublishes,
    blockedTargetsTotal: g.totalBlockedTargets,
    unsyncedPublishedTotal: g.totalUnsyncedPublished,
    openHandoffsTotal: g.totalOpenHandoffs,
    handoffReadyLeadsTotal: g.totalHandoffReadyLeads,
    queueDraftStaleTotal: queueDraftStale,
    promotionReadyTotal: promotionReady,
    suppressedAssetTotal: suppressed,
    cadenceStaleWorkspaceCount: cadenceStale,
    criticalExceptionCount: ex.criticalExceptions.length,
    warningExceptionCount: ex.warningExceptions.length,
    systemHealthScore: o.systemHealthScore,
    workspaceCount: g.workspaceCount,
    approvalPressureScore: approvalPressure,
    generatedAt: o.generatedAt,
  };
}

export function observationDelta(
  current: BentleyRolloutObservation,
  baseline: BentleyRolloutObservation | null
): {
  failedPublishDelta: number;
  approvalPressureDelta: number;
  handoffDelta: number;
  criticalDelta: number;
} {
  if (!baseline) {
    return {
      failedPublishDelta: 0,
      approvalPressureDelta: 0,
      handoffDelta: 0,
      criticalDelta: 0,
    };
  }
  return {
    failedPublishDelta: current.failedPublishTotal - baseline.failedPublishTotal,
    approvalPressureDelta: current.approvalPressureScore - baseline.approvalPressureScore,
    handoffDelta: current.handoffReadyLeadsTotal - baseline.handoffReadyLeadsTotal,
    criticalDelta: current.criticalExceptionCount - baseline.criticalExceptionCount,
  };
}
