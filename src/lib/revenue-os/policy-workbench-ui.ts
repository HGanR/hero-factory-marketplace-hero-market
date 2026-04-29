/**
 * UI-ready payloads for the policy tuning workbench (cards, tables, panels).
 */

import type { BentleyPolicyWorkbenchBuild, BentleyPolicyScenarioRunResult } from "@/lib/revenue-os/policy-tuning-workbench";
import type { AutonomousPolicyRow } from "@/lib/revenue-os/autonomous-policies-db";
import type { AutomationPolicyRow } from "@/lib/revenue-os/automation-policies-db";
import type { NotificationPolicyRow } from "@/lib/revenue-os/notification-db";
import { buildSimulationComparisonTablePayload, buildPolicyDeltaRiskPanel } from "@/lib/revenue-os/simulation-ui";

export type PolicyCard = { id: string; title: string; subtitle: string; meta: string };

export function buildCurrentPolicySummaryCards(input: BentleyPolicyWorkbenchBuild): { cards: PolicyCard[]; emptyState: string | null } {
  if (input.empty) {
    return {
      cards: [],
      emptyState: "No policies in scope yet — connect workspaces or add autonomous / automation / notification policies.",
    };
  }
  return {
    cards: [
      {
        id: "autonomous",
        title: "Autonomous action policies",
        subtitle: `${input.autonomousPolicyCount} configured`,
        meta: "Thresholds, approvals, cooldowns",
      },
      {
        id: "automation",
        title: "Automation policies",
        subtitle: `${input.automationPolicyCount} configured`,
        meta: "Scheduled reports & operator automations",
      },
      {
        id: "notifications",
        title: "Notification policies",
        subtitle: `${input.notificationPolicyCount} configured`,
        meta: "Severity routing to channels",
      },
    ],
    emptyState: null,
  };
}

export type EditablePolicyGroup = {
  key: string;
  label: string;
  description: string;
  jsonPointer: string;
};

export function buildEditablePolicyGroups(): EditablePolicyGroup[] {
  return [
    {
      key: "autonomous",
      label: "Autonomous actions",
      description: "policyPatchesById + candidate pairs for dry-run evaluation.",
      jsonPointer: "/autonomous",
    },
    {
      key: "cadence",
      label: "Cadence / queue",
      description: "Stale draft days, hypothetical winner approval bypass.",
      jsonPointer: "/cadence",
    },
    {
      key: "notifications",
      label: "Notifications",
      description: "Minimum severity for in-app / routed events.",
      jsonPointer: "/notifications",
    },
  ];
}

export function buildSimulationResultCards(run: BentleyPolicyScenarioRunResult): {
  baseline: { title: string; lines: string[] };
  proposed: { title: string; lines: string[] };
  delta: { title: string; lines: string[] };
} {
  return {
    baseline: {
      title: "Baseline (current evaluation context)",
      lines: run.baselineSummary ? [run.baselineSummary] : ["No baseline lines — expand proposal."],
    },
    proposed: {
      title: "Proposed (simulated)",
      lines: run.proposedSummary ? [run.proposedSummary] : ["Proposal did not change simulated dimensions."],
    },
    delta: {
      title: "Predicted delta",
      lines: [run.deltaSummary, ...run.partialReasons].filter(Boolean),
    },
  };
}

export function buildWorkbenchBeforeAfterTable(run: BentleyPolicyScenarioRunResult): ReturnType<typeof buildSimulationComparisonTablePayload> {
  return buildSimulationComparisonTablePayload({
    autonomous: run.autonomous ?? undefined,
    cadence: run.cadence ?? undefined,
    notifications: run.notifications ?? undefined,
  });
}

export function buildWorkbenchRiskPanel(run: BentleyPolicyScenarioRunResult): ReturnType<typeof buildPolicyDeltaRiskPanel> {
  return buildPolicyDeltaRiskPanel({
    comparison: run.comparison,
    autonomousRiskFlags: run.autonomous?.riskFlags,
  });
}

export function buildRecommendationCallout(run: BentleyPolicyScenarioRunResult): {
  title: string;
  body: string;
  badge: "review" | "ok";
  nextStep: string;
} {
  return {
    title: run.recommendation.title,
    body: run.recommendation.body,
    badge: run.recommendation.humanReviewAdvised ? "review" : "ok",
    nextStep: run.suggestedNextChange,
  };
}

/** Maps a proposed autonomous patch to the existing upsert API body shape (caller must confirm before POST). */
export function buildAutonomousUpsertPayloadFromPatch(input: {
  policy: AutonomousPolicyRow;
  patch: Partial<
    Pick<AutonomousPolicyRow, "isEnabled" | "requiresApprovalAboveSeverity" | "maxDailyExecutions" | "cooldownMinutes" | "policyConfigJson">
  >;
}): Record<string, unknown> {
  const p = input.policy;
  const x = input.patch;
  return {
    id: p.id,
    clientId: p.clientId,
    trustId: p.trustId,
    actionType: p.actionType,
    isEnabled: x.isEnabled ?? p.isEnabled,
    requiresApprovalAboveSeverity: x.requiresApprovalAboveSeverity ?? p.requiresApprovalAboveSeverity,
    maxDailyExecutions: x.maxDailyExecutions !== undefined ? x.maxDailyExecutions : p.maxDailyExecutions,
    cooldownMinutes: x.cooldownMinutes !== undefined ? x.cooldownMinutes : p.cooldownMinutes,
    policyConfigJson: x.policyConfigJson !== undefined ? x.policyConfigJson : p.policyConfigJson,
  };
}

export function isCadenceLikeAutomationPolicy(policy: Pick<AutomationPolicyRow, "policyType">): boolean {
  const t = policy.policyType;
  return t === "stale_backlog_cleanup" || t === "daily_cadence_run";
}

/** Reviewed apply for cadence-related automation policies — merges stale threshold into policyConfigJson. */
export function buildAutomationUpsertPayloadFromCadenceForm(input: {
  policy: AutomationPolicyRow;
  staleDraftDaysProposed: number | null;
}): Record<string, unknown> {
  const p = input.policy;
  const base =
    typeof p.policyConfigJson === "object" && p.policyConfigJson !== null
      ? ({ ...(p.policyConfigJson as Record<string, unknown>) } as Record<string, unknown>)
      : ({} as Record<string, unknown>);
  if (input.staleDraftDaysProposed != null && Number.isFinite(input.staleDraftDaysProposed)) {
    base.staleDraftDaysThreshold = input.staleDraftDaysProposed;
  }
  return {
    id: p.id,
    clientId: p.clientId,
    trustId: p.trustId,
    policyType: p.policyType,
    isEnabled: p.isEnabled,
    scheduleJson: p.scheduleJson,
    policyConfigJson: base,
  };
}

export function buildCadenceApplyReviewPayload(input: { body: Record<string, unknown> }): {
  route: string;
  method: string;
  description: string;
  preview: Record<string, unknown>;
} {
  return {
    route: "/api/revenue-os/automations/policies/upsert",
    method: "POST",
    description: "Automation policy upsert — use for cadence / stale-backlog style policies.",
    preview: input.body,
  };
}

export function buildNotificationPolicyUpsertPayloadFromForm(input: {
  policy: NotificationPolicyRow;
  minimumSeverity: "info" | "warning" | "critical";
}): Record<string, unknown> {
  const p = input.policy;
  return {
    id: p.id,
    clientId: p.clientId,
    trustId: p.trustId,
    eventType: p.eventType,
    channelId: p.channelId,
    isEnabled: p.isEnabled,
    minimumSeverity: input.minimumSeverity,
    policyConfigJson: p.policyConfigJson,
  };
}

export function buildNotificationApplyReviewPayload(input: { body: Record<string, unknown> }): {
  route: string;
  method: string;
  description: string;
  preview: Record<string, unknown>;
} {
  return {
    route: "/api/revenue-os/notifications/policies/upsert",
    method: "POST",
    description: "Notification routing policy upsert.",
    preview: input.body,
  };
}

export type PolicyApplyFamily = "autonomous" | "cadence_automation" | "notification";

export function buildUnifiedApplyReviewStub(input: {
  family: PolicyApplyFamily;
  route: string;
  preview: Record<string, unknown>;
}): { family: PolicyApplyFamily; route: string; preview: Record<string, unknown> } {
  return { family: input.family, route: input.route, preview: input.preview };
}
