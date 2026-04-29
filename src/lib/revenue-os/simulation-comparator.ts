/**
 * Compares baseline vs simulated policy outcomes (dry-run only).
 */

import type { AutonomousPolicySimulationResult } from "@/lib/revenue-os/policy-simulation";

export type BentleySimulationComparison = {
  addedAutoActions: number;
  removedAutoActions: number;
  addedApprovals: number;
  removedApprovals: number;
  changedNotifications: number | null;
  changedQueueStates: number | null;
  summaryDelta: string;
  /** Optional — e.g. handoff automation volume delta when provided by workbench. */
  handoffVolumeDelta?: number | null;
};

export function compareBentleySimulationAgainstCurrent(input: {
  autonomous?: AutonomousPolicySimulationResult | null;
  notificationEventsDelta?: number | null;
  queueStateDelta?: number | null;
}): BentleySimulationComparison {
  const a = input.autonomous;
  let addedAutoActions = 0;
  let removedAutoActions = 0;
  if (a) {
    for (const ch of a.changedOutcomes) {
      if (ch.to === "auto_execute" && ch.from !== "auto_execute") addedAutoActions += 1;
      if (ch.from === "auto_execute" && ch.to !== "auto_execute") removedAutoActions += 1;
    }
  }

  const addedApprovals = a?.increasedApprovals ?? 0;
  const removedApprovals = a?.decreasedApprovals ?? 0;

  const summaryDelta = [
    a ? `Autonomous: Δ approvals +${addedApprovals}/-${removedApprovals}, auto +${addedAutoActions}/-${removedAutoActions}.` : "",
    input.notificationEventsDelta != null ? `Notifications: ${input.notificationEventsDelta >= 0 ? "+" : ""}${input.notificationEventsDelta} events.` : "",
    input.queueStateDelta != null ? `Queue heuristic delta: ${input.queueStateDelta}.` : "",
  ]
    .filter(Boolean)
    .join(" ")
    .slice(0, 1200);

  return {
    addedAutoActions,
    removedAutoActions,
    addedApprovals,
    removedApprovals,
    changedNotifications: input.notificationEventsDelta ?? null,
    changedQueueStates: input.queueStateDelta ?? null,
    summaryDelta: summaryDelta || "No comparable simulation deltas provided.",
    handoffVolumeDelta: null,
  };
}
