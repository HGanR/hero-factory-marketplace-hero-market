/**
 * Dispatch operator command surface actions to existing queue / cadence / publish helpers.
 */

import { approveDistributionQueueItem, archiveDistributionQueueItem, scheduleDistributionQueueItem } from "@/lib/revenue-os/distribution-queue-actions";
import { executePublishAction } from "@/lib/revenue-os/publish-executor";
import { syncPublishedQueuePerformance } from "@/lib/revenue-os/post-publication-sync";
import { createLeadHandoff } from "@/lib/revenue-os/lead-handoff";
import { executeBentleyCadenceRun, type BentleyCadenceRunType } from "@/lib/revenue-os/execute-cadence-run";

export type OperatorRunActionType =
  | "approve_queue_item"
  | "retry_publish"
  | "archive_queue_item"
  | "run_cadence"
  | "create_lead_handoff"
  | "sync_performance"
  | "schedule_queue_item";

export type DispatchBentleyOperatorActionInput = {
  userId: string;
  actionType: OperatorRunActionType;
  clientId: string;
  trustId: string;
  queueId?: string;
  queueTargetId?: string | null;
  leadSignalId?: string;
  scheduledFor?: string | Date | null;
  dryRun?: boolean;
  runType?: BentleyCadenceRunType;
  mockOrManual?: boolean;
  manualOverride?: boolean;
};

export type DispatchBentleyOperatorActionResult = {
  ok: boolean;
  reason?: string;
  dryRun?: boolean;
  details?: Record<string, unknown>;
};

export async function dispatchBentleyOperatorAction(
  input: DispatchBentleyOperatorActionInput
): Promise<DispatchBentleyOperatorActionResult> {
  const uid = String(input.userId).trim();
  const clientId = input.clientId ?? "";
  const trustId = input.trustId ?? "";
  const scope = { userId: uid, clientId, trustId };

  switch (input.actionType) {
    case "approve_queue_item": {
      if (!input.queueId?.trim()) return { ok: false, reason: "queueId_required" };
      if (input.dryRun) {
        return { ok: true, dryRun: true, details: { wouldApprove: input.queueId } };
      }
      const r = await approveDistributionQueueItem({ ...scope, queueId: input.queueId });
      return { ok: r.ok, reason: r.reason, details: { row: r.row?.id } };
    }
    case "archive_queue_item": {
      if (!input.queueId?.trim()) return { ok: false, reason: "queueId_required" };
      if (input.dryRun) {
        return { ok: true, dryRun: true, details: { wouldArchive: input.queueId } };
      }
      const r = await archiveDistributionQueueItem({ ...scope, queueId: input.queueId });
      return { ok: r.ok, reason: r.reason, details: { row: r.row?.id } };
    }
    case "schedule_queue_item": {
      if (!input.queueId?.trim()) return { ok: false, reason: "queueId_required" };
      const when =
        input.scheduledFor instanceof Date
          ? input.scheduledFor
          : input.scheduledFor
            ? new Date(input.scheduledFor)
            : null;
      if (!when || Number.isNaN(when.getTime())) return { ok: false, reason: "scheduledFor_invalid" };
      if (input.dryRun) {
        return { ok: true, dryRun: true, details: { wouldSchedule: input.queueId, scheduledFor: when.toISOString() } };
      }
      const r = await scheduleDistributionQueueItem({ ...scope, queueId: input.queueId, scheduledFor: when });
      return { ok: r.ok, reason: r.reason, details: { row: r.row?.id } };
    }
    case "retry_publish": {
      if (!input.queueId?.trim()) return { ok: false, reason: "queueId_required" };
      if (input.dryRun) {
        return { ok: true, dryRun: true, details: { wouldPublish: input.queueId } };
      }
      const exec = await executePublishAction({
        ...scope,
        queueId: input.queueId,
        queueTargetId: input.queueTargetId ?? undefined,
        manualOverride: input.manualOverride ?? false,
        mockOrManual: input.mockOrManual ?? false,
      });
      return {
        ok: exec.ok,
        reason: exec.reason,
        details: {
          executionMode: exec.executionMode,
          targetPlatform: exec.targetPlatform,
        },
      };
    }
    case "sync_performance": {
      if (input.dryRun) {
        return { ok: true, dryRun: true, details: { wouldSyncQueueId: input.queueId ?? null } };
      }
      const r = await syncPublishedQueuePerformance({
        userId: uid,
        clientId,
        trustId,
        queueId: input.queueId?.trim(),
        externalPostRef: undefined,
        metrics: {},
      });
      return { ok: r.ok, reason: r.reason, details: { queueId: r.queueId } };
    }
    case "create_lead_handoff": {
      if (!input.leadSignalId?.trim()) return { ok: false, reason: "leadSignalId_required" };
      if (input.dryRun) {
        return { ok: true, dryRun: true, details: { wouldCreateFor: input.leadSignalId } };
      }
      const row = await createLeadHandoff({
        userId: uid,
        clientId,
        trustId,
        leadSignalId: input.leadSignalId,
      });
      return { ok: Boolean(row), reason: row ? undefined : "handoff_rejected", details: { id: row?.id } };
    }
    case "run_cadence": {
      const result = await executeBentleyCadenceRun({
        userId: uid,
        clientId,
        trustId,
        runType: input.runType ?? "daily_refresh",
        dryRun: input.dryRun ?? false,
      });
      return {
        ok: true,
        dryRun: input.dryRun ?? false,
        details: {
          cadenceRunId: result.cadenceRunId,
          runPersisted: result.runPersisted,
          queueUpdates: result.queueUpdates,
          cadenceSummary: result.plan.cadenceSummary,
        },
      };
    }
    default:
      return { ok: false, reason: "unknown_action" };
  }
}
