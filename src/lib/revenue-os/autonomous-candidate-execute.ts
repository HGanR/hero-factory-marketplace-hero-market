/**
 * Execute a collected autonomous candidate via existing operator/dispatch helpers.
 */

import { dispatchBentleyOperatorAction } from "@/lib/revenue-os/operator-run-dispatch";
import {
  markDistributionQueueCadenceBlocked,
  suppressDistributionQueueItem,
} from "@/lib/revenue-os/distribution-queue-actions";
import type { BentleyAutonomousCandidate } from "@/lib/revenue-os/autonomous-candidates";

export async function executeBentleyAutonomousCandidate(params: {
  userId: string;
  candidate: BentleyAutonomousCandidate;
  dryRun: boolean;
}): Promise<{ ok: boolean; reason?: string; details?: Record<string, unknown> }> {
  const { userId, candidate: c, dryRun } = params;
  const scope = { userId, clientId: c.scope.clientId, trustId: c.scope.trustId };

  switch (c.actionType) {
    case "auto_retry_failed_publish":
      if (!c.queueId) return { ok: false, reason: "queueId_required" };
      return dispatchBentleyOperatorAction({
        ...scope,
        actionType: "retry_publish",
        queueId: c.queueId,
        dryRun,
      });
    case "auto_schedule_promoted_winner":
      if (!c.queueId) return { ok: false, reason: "queueId_required" };
      return dispatchBentleyOperatorAction({
        ...scope,
        actionType: "schedule_queue_item",
        queueId: c.queueId,
        scheduledFor: c.scheduledForIso ?? new Date(Date.now() + 3600_000).toISOString(),
        dryRun,
      });
    case "auto_archive_stale_draft":
      if (!c.queueId) return { ok: false, reason: "queueId_required" };
      return dispatchBentleyOperatorAction({
        ...scope,
        actionType: "archive_queue_item",
        queueId: c.queueId,
        dryRun,
      });
    case "auto_create_lead_handoff":
      if (!c.leadSignalId) return { ok: false, reason: "leadSignalId_required" };
      return dispatchBentleyOperatorAction({
        ...scope,
        actionType: "create_lead_handoff",
        leadSignalId: c.leadSignalId,
        dryRun,
      });
    case "auto_run_cadence":
      return dispatchBentleyOperatorAction({
        ...scope,
        actionType: "run_cadence",
        runType: "daily_refresh",
        dryRun,
      });
    case "auto_sync_published_metrics":
      return dispatchBentleyOperatorAction({
        ...scope,
        actionType: "sync_performance",
        queueId: c.queueId,
        dryRun,
      });
    case "auto_suppress_low_confidence_loser":
      if (!c.queueId) return { ok: false, reason: "queueId_required" };
      if (dryRun) return { ok: true, details: { dryRun: true } };
      {
        const r = await suppressDistributionQueueItem({
          userId,
          clientId: c.scope.clientId,
          trustId: c.scope.trustId,
          queueId: c.queueId,
          reason: c.reason.slice(0, 512),
        });
        return { ok: r.ok, reason: r.reason, details: { rowId: r.row?.id } };
      }
    case "auto_mark_manual_export_needed":
      if (!c.queueId) return { ok: false, reason: "queueId_required" };
      if (dryRun) return { ok: true, details: { dryRun: true } };
      {
        const r = await markDistributionQueueCadenceBlocked({
          userId,
          clientId: c.scope.clientId,
          trustId: c.scope.trustId,
          queueId: c.queueId,
          note: c.reason.slice(0, 8000),
        });
        return { ok: r.ok, reason: r.reason, details: { rowId: r.row?.id } };
      }
    default:
      return { ok: false, reason: "unknown_action_type" };
  }
}
