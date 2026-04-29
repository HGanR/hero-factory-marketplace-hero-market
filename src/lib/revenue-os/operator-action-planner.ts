/**
 * Concrete operator actions from workspace summaries + prioritization.
 */

import type { OperatorWorkspaceSummary } from "@/lib/revenue-os/operator-types";
import type { WorkspacePrioritizationResult } from "@/lib/revenue-os/workspace-prioritization";

export type OperatorActionUrgency = "immediate" | "today" | "this_week" | "blocked";

export type OperatorPlannedAction = {
  actionType: string;
  workspace: { clientId: string; trustId: string };
  reason: string;
  urgency: OperatorActionUrgency;
  expectedImpact: string;
  queueId?: string;
  leadSignalId?: string;
};

export type PlanBentleyOperatorActionsResult = {
  immediateActions: OperatorPlannedAction[];
  todayActions: OperatorPlannedAction[];
  thisWeekActions: OperatorPlannedAction[];
  blockedActions: OperatorPlannedAction[];
  actionSummary: string;
};

export type PlanBentleyOperatorActionsInput = {
  workspaceSummaries: OperatorWorkspaceSummary[];
  prioritization: WorkspacePrioritizationResult;
};

function wsRef(w: OperatorWorkspaceSummary["workspace"]) {
  return { clientId: w.clientId ?? "", trustId: w.trustId ?? "" };
}

export function planBentleyOperatorActions(input: PlanBentleyOperatorActionsInput): PlanBentleyOperatorActionsResult {
  const immediate: OperatorPlannedAction[] = [];
  const today: OperatorPlannedAction[] = [];
  const week: OperatorPlannedAction[] = [];
  const blocked: OperatorPlannedAction[] = [];

  for (const s of input.workspaceSummaries) {
    const w = wsRef(s.workspace);
    if (s.blockedConnectorTargets > 0) {
      today.push({
        actionType: "connect_missing_account",
        workspace: w,
        reason: `${s.blockedConnectorTargets} target(s) blocked by connector routing.`,
        urgency: "today",
        expectedImpact: "Unlock auto-publish for queued assets.",
      });
    }
    if (s.failedCount > 0) {
      immediate.push({
        actionType: "retry_publish",
        workspace: w,
        reason: `${s.failedCount} failed publish(es) need retry or creative fix.`,
        urgency: "immediate",
        expectedImpact: "Recover pipeline throughput.",
      });
    }
    if (s.openHandoffs > 0) {
      immediate.push({
        actionType: "review_handoff_ready_leads",
        workspace: w,
        reason: `${s.openHandoffs} open handoff(s); ${s.handoffReadyLeads} handoff-ready lead(s).`,
        urgency: "immediate",
        expectedImpact: "Route revenue-ready conversations.",
      });
    }
    if (s.promotionReadyCount > 0) {
      today.push({
        actionType: "publish_promoted_winner",
        workspace: w,
        reason: `${s.promotionReadyCount} cadence-promoted asset(s) ready.`,
        urgency: "today",
        expectedImpact: "Scale winning experiment cells.",
      });
    }
    if (s.publishedUnsyncedCount > 0) {
      today.push({
        actionType: "sync_performance",
        workspace: w,
        reason: `${s.publishedUnsyncedCount} published row(s) missing performance sync.`,
        urgency: "today",
        expectedImpact: "Close experiment feedback loop.",
      });
    }
    if (s.staleBacklogCount > 2) {
      week.push({
        actionType: "clear_stale_drafts",
        workspace: w,
        reason: `${s.staleBacklogCount} stale draft/scheduled item(s).`,
        urgency: "this_week",
        expectedImpact: "Reduce queue clutter and strategic drift.",
      });
    }
    if (s.connectorAutoPublishReady === 0 && s.queueTotal > 0) {
      blocked.push({
        actionType: "connect_missing_account",
        workspace: w,
        reason: "No auto-publish connector — manual export or OAuth required.",
        urgency: "blocked",
        expectedImpact: "Enable automated execution.",
      });
    }
  }

  const actionSummary = [
    immediate.length ? `${immediate.length} immediate` : "",
    today.length ? `${today.length} today` : "",
    week.length ? `${week.length} this week` : "",
    blocked.length ? `${blocked.length} blocked` : "",
  ]
    .filter(Boolean)
    .join(", ");

  return {
    immediateActions: immediate.slice(0, 30),
    todayActions: today.slice(0, 30),
    thisWeekActions: week.slice(0, 20),
    blockedActions: blocked.slice(0, 20),
    actionSummary: actionSummary || "No operator actions required.",
  };
}
