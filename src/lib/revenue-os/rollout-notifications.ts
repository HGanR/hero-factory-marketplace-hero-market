/**
 * Emits in-app notification events for rollout monitoring (uses shared insertNotificationEvent).
 */

import { insertNotificationEvent } from "@/lib/revenue-os/notification-db";
import type { BentleyRolloutMonitoringResult } from "@/lib/revenue-os/rollout-monitoring";

export type RolloutNotificationKind =
  | "rollout_stage_healthy"
  | "rollout_stage_warning"
  | "rollout_rollback_recommended"
  | "rollout_ready_to_advance";

/** Maps monitoring outcome to a single notification kind (for persisted checks). */
export function rolloutNotificationKindFromMonitoring(m: BentleyRolloutMonitoringResult): RolloutNotificationKind {
  if (m.recommendedNextAction === "recommend_rollback") return "rollout_rollback_recommended";
  if (m.recommendedNextAction === "advance_stage" && m.rolloutHealth === "healthy") return "rollout_ready_to_advance";
  if (m.rolloutHealth === "healthy") return "rollout_stage_healthy";
  return "rollout_stage_warning";
}

export async function emitRolloutMonitoringNotification(input: {
  userId: string;
  clientId: string;
  trustId: string;
  kind: RolloutNotificationKind;
  planId: string;
  runId: string;
  summary: string;
  monitoring: BentleyRolloutMonitoringResult;
}): Promise<{ ok: boolean }> {
  const severity =
    input.kind === "rollout_rollback_recommended"
      ? "critical"
      : input.kind === "rollout_stage_warning"
        ? "warning"
        : "info";

  const title =
    input.kind === "rollout_stage_healthy"
      ? "Rollout stage healthy"
      : input.kind === "rollout_stage_warning"
        ? "Rollout stage warning"
        : input.kind === "rollout_rollback_recommended"
          ? "Rollback recommended"
          : "Rollout ready to advance";

  const eventType =
    input.kind === "rollout_stage_healthy"
      ? "rollout_stage_healthy"
      : input.kind === "rollout_stage_warning"
        ? "rollout_stage_warning"
        : input.kind === "rollout_rollback_recommended"
          ? "rollout_rollback_recommended"
          : "rollout_ready_to_advance";

  const dedupeKey = `rollout:${input.runId}:${eventType}:${new Date().toISOString().slice(0, 13)}`;

  const r = await insertNotificationEvent({
    userId: input.userId,
    clientId: input.clientId || "default",
    trustId: input.trustId || "default",
    sourceType: "bentley_rollout",
    eventType,
    severity,
    title,
    body: input.summary.slice(0, 2000),
    eventPayloadJson: {
      planId: input.planId,
      runId: input.runId,
      health: input.monitoring.rolloutHealth,
      nextAction: input.monitoring.recommendedNextAction,
    },
    dedupeKey,
  });

  return { ok: r.ok };
}
