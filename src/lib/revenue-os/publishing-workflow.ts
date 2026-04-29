/**
 * Planning layer: maps distribution plan + queue + signals → actionable workflow buckets.
 */

import type { BentleyDistributionPlan } from "@/lib/revenue-os/market-sweep-schema";
import type { ConnectorCoverageSummary } from "@/lib/revenue-os/distribution-routing";
import type { LeadSignalSummary } from "@/lib/revenue-os/lead-signal-summary";
import type { DistributionQueueRow } from "@/lib/revenue-os/distribution-queue-actions";
import type { BentleyCadencePlan } from "@/lib/revenue-os/cadence-engine";

export type PublishingWorkflowAction =
  | "approve"
  | "schedule"
  | "publish_now"
  | "sync_metrics"
  | "retry"
  | "archive";

export type QueueWorkflowItem = {
  queueId: string;
  title: string;
  platform: string;
  actions: PublishingWorkflowAction[];
  reason: string;
};

export type BuildPublishingWorkflowInput = {
  distributionPlan: BentleyDistributionPlan | null | undefined;
  queueItems: DistributionQueueRow[];
  platformFormatHints?: Array<{ platform: string; format: string; reason: string }>;
  leadSignalSummary?: LeadSignalSummary | null;
  /** When false, draft items still need approval before schedule. Default true = approvals on. */
  approvalsRequired?: boolean;
  /** Optional cadence plan — elevates winners, surfaces suppressed rows. */
  cadencePlan?: BentleyCadencePlan | null;
};

export type PublishingWorkflowResult = {
  readyToApprove: QueueWorkflowItem[];
  readyToSchedule: QueueWorkflowItem[];
  readyToPublish: QueueWorkflowItem[];
  /** Published rows waiting for metrics backfill. */
  itemsNeedingPerformanceSync: QueueWorkflowItem[];
  blockedItems: QueueWorkflowItem[];
  retryItems: QueueWorkflowItem[];
  workflowSummary: string;
};

function itemReason(q: DistributionQueueRow): string {
  if (q.approvalStatus === "pending" && q.queueStatus === "draft") return "Awaiting approval.";
  if (q.queueStatus === "failed") return q.lastPublishError ? `Publish failed: ${q.lastPublishError.slice(0, 120)}` : "Publish failed — retry or revise.";
  if (q.queueStatus === "published" && q.performanceSyncStatus !== "synced" && !q.lastSyncedAt) {
    return "Published — performance not synced yet.";
  }
  return `${q.queueStatus} / ${q.approvalStatus}`;
}

export function buildPublishingWorkflow(input: BuildPublishingWorkflowInput): PublishingWorkflowResult {
  const approvals = input.approvalsRequired !== false;
  const items = input.queueItems ?? [];
  const cadencePlan = input.cadencePlan;

  const readyToApprove: QueueWorkflowItem[] = [];
  const readyToSchedule: QueueWorkflowItem[] = [];
  const readyToPublish: QueueWorkflowItem[] = [];
  const itemsNeedingPerformanceSync: QueueWorkflowItem[] = [];
  const blockedItems: QueueWorkflowItem[] = [];
  const retryItems: QueueWorkflowItem[] = [];

  for (const q of items) {
    if (q.queueStatus === "archived") continue;

    const base: QueueWorkflowItem = {
      queueId: q.id,
      title: q.title,
      platform: q.platform,
      actions: [],
      reason: itemReason(q),
    };

    if (q.queueStatus === "failed") {
      retryItems.push({
        ...base,
        actions: ["retry", "archive"],
        reason: base.reason,
      });
      continue;
    }

    if (q.queueStatus === "published") {
      if (q.performanceSyncStatus !== "synced" && q.lastSyncedAt == null) {
        itemsNeedingPerformanceSync.push({
          ...base,
          actions: ["sync_metrics"],
          reason: "Published asset — pull or enter performance metrics.",
        });
      }
      continue;
    }

    if (approvals && q.approvalStatus === "pending" && q.queueStatus === "draft") {
      readyToApprove.push({
        ...base,
        actions: ["approve", "archive"],
        reason: "Pending approval before scheduling.",
      });
      continue;
    }

    if (q.approvalStatus === "rejected") {
      blockedItems.push({ ...base, actions: ["archive"], reason: "Rejected — unblock or duplicate as new draft." });
      continue;
    }

    if (q.queueStatus === "approved" || (!approvals && q.queueStatus === "draft")) {
      readyToSchedule.push({
        ...base,
        actions: ["schedule", "publish_now"],
        reason: "Approved — pick a slot or publish now (manual/mock).",
      });
      continue;
    }

    if (q.queueStatus === "scheduled") {
      const when = q.scheduledFor ? new Date(q.scheduledFor).toISOString() : "unspecified";
      readyToPublish.push({
        ...base,
        actions: ["publish_now", "archive"],
        reason: `Scheduled for ${when}.`,
      });
      continue;
    }

    blockedItems.push({
      ...base,
      actions: [],
      reason: `Unexpected state ${q.queueStatus}/${q.approvalStatus}`,
    });
  }

  if (cadencePlan) {
    const promoteIds = new Set(cadencePlan.promoteNow.map((x) => x.queueId));
    for (const q of items) {
      if (q.queueStatus === "archived") continue;
      if (!promoteIds.has(q.id)) continue;
      if (q.approvalStatus === "approved" || q.queueStatus === "scheduled") {
        const dup = readyToPublish.some((x) => x.queueId === q.id);
        if (!dup) {
          readyToPublish.push({
            queueId: q.id,
            title: q.title,
            platform: q.platform,
            actions: ["publish_now", "schedule"],
            reason: "Cadence: promoted winner — publish or adjust slot.",
          });
        }
      } else if (q.approvalStatus === "pending" && q.queueStatus === "draft") {
        if (!readyToApprove.some((x) => x.queueId === q.id)) {
          readyToApprove.push({
            queueId: q.id,
            title: q.title,
            platform: q.platform,
            actions: ["approve", "archive"],
            reason: "Cadence: promoted winner — approve to unlock scheduling.",
          });
        }
      }
    }
    for (const s of cadencePlan.suppressNow) {
      const q = items.find((i) => i.id === s.queueId);
      if (!q || q.queueStatus === "archived") continue;
      blockedItems.push({
        queueId: q.id,
        title: q.title,
        platform: q.platform,
        actions: ["archive"],
        reason: `Cadence suppressed: ${s.reason.slice(0, 220)}`,
      });
    }
  }

  const hintCount = input.platformFormatHints?.length ?? 0;
  const lead = input.leadSignalSummary;
  let workflowSummary = [
    readyToApprove.length ? `${readyToApprove.length} item(s) need approval.` : "",
    readyToSchedule.length ? `${readyToSchedule.length} ready to schedule.` : "",
    readyToPublish.filter((x) => x.actions.includes("publish_now")).length
      ? `${readyToPublish.filter((x) => x.actions.includes("publish_now")).length} ready to publish.`
      : "",
    itemsNeedingPerformanceSync.length
      ? `${itemsNeedingPerformanceSync.length} published item(s) need metrics sync.`
      : "",
    retryItems.length ? `${retryItems.length} failed — retry available.` : "",
    lead && lead.handoffReadyLeads > 0 ? `${lead.handoffReadyLeads} handoff-ready lead signal(s).` : "",
    hintCount ? `${hintCount} platform/format hint(s) from sweep.` : "",
    cadencePlan?.cadenceSummary ? `Cadence: ${cadencePlan.cadenceSummary.slice(0, 400)}` : "",
  ]
    .filter(Boolean)
    .join(" ");

  if (!workflowSummary.trim()) {
    workflowSummary =
      items.length === 0
        ? "No distribution queue items yet — run a market sweep with experiments to draft assets."
        : "Queue is clear of blocking workflow steps.";
  }

  return {
    readyToApprove,
    readyToSchedule,
    readyToPublish,
    itemsNeedingPerformanceSync,
    blockedItems,
    retryItems,
    workflowSummary: workflowSummary.slice(0, 2000),
  };
}

export type WorkflowOperationalGuidance = {
  workflowSummary: string;
  approvalBottleneckLine?: string;
  publishFailureLine?: string;
  unsyncedMetricLine?: string;
  handoffBacklogLine?: string;
  bentleyOperationalNextStep?: string;
  connectorCoverageSummary?: ConnectorCoverageSummary | null;
  connectorSummaryLine?: string;
  cadenceSummary?: string;
  cadenceNextAction?: string;
  cadencePromotionCount?: number;
  cadenceSuppressionCount?: number;
  cadenceRetryCount?: number;
  cadenceStaleCount?: number;
  cadenceRetestRecommendationCount?: number;
};

/**
 * Compact operator-facing lines for growth guidance + notes (no DB — pass counts from caller or empty).
 */
export function buildWorkflowOperationalGuidance(input: {
  workflow: PublishingWorkflowResult;
  handoffOpenCount?: number;
  connectorCoverageSummary?: ConnectorCoverageSummary | null;
  cadencePlan?: BentleyCadencePlan | null;
}): WorkflowOperationalGuidance {
  const w = input.workflow;
  const approvalBlock = w.readyToApprove.length
    ? `${w.readyToApprove.length} asset(s) blocked pending approval.`
    : undefined;
  const failLine = w.retryItems.length
    ? `${w.retryItems.length} publish attempt(s) failed — review CTA or platform, then retry.`
    : undefined;
  const unsynced = w.itemsNeedingPerformanceSync.length;
  const unsyncedLine = unsynced
    ? `${unsynced} published item(s) need performance sync.`
    : undefined;
  const ho =
    input.handoffOpenCount && input.handoffOpenCount > 0
      ? `${input.handoffOpenCount} open lead handoff(s) need follow-up.`
      : undefined;

  const cad = input.cadencePlan;
  let next = "";
  if (cad?.nextSchedulerAction) next = cad.nextSchedulerAction.slice(0, 500);
  else if (w.readyToApprove.length) next = "Approve or reject queued assets to unblock publishing.";
  else if (w.retryItems.length) next = "Retry failed publishes with revised creative or manual post reference.";
  else if (w.readyToSchedule.length) next = "Schedule approved assets or publish now in mock/manual mode.";
  else if (unsynced) next = "Sync post metrics for published experiments.";
  else if (ho) next = "Route open handoffs to sales or support.";
  else next = "Monitor published performance and feed results back into experiments.";

  const cc = input.connectorCoverageSummary;
  const connectorSummaryLine = cc
    ? [
        cc.autoPublishReadyCount
          ? `${cc.autoPublishReadyCount} asset(s) ready for auto-publish to connected accounts.`
          : "",
        cc.manualFallbackCount
          ? `${cc.manualFallbackCount} asset(s) need manual export or are blocked by routing.`
          : "",
        cc.blockedTargetsCount
          ? `${cc.blockedTargetsCount} target(s) blocked (missing connector or capability mismatch).`
          : "",
        cc.recommendedConnectorAction ? `Next: ${cc.recommendedConnectorAction}` : "",
      ]
        .filter(Boolean)
        .join(" ")
        .slice(0, 2000)
    : undefined;

  return {
    workflowSummary: w.workflowSummary,
    approvalBottleneckLine: approvalBlock,
    publishFailureLine: failLine,
    unsyncedMetricLine: unsyncedLine,
    handoffBacklogLine: ho,
    bentleyOperationalNextStep: next.slice(0, 500),
    connectorCoverageSummary: cc ?? undefined,
    connectorSummaryLine,
    cadenceSummary: cad?.cadenceSummary,
    cadenceNextAction: cad?.nextSchedulerAction,
    cadencePromotionCount: cad?.promoteNow.length,
    cadenceSuppressionCount: cad?.suppressNow.length,
    cadenceRetryCount: cad?.retryNow.length,
    cadenceStaleCount: cad?.archiveNow.length,
    cadenceRetestRecommendationCount: cad?.retestRecommendations.length,
  };
}
