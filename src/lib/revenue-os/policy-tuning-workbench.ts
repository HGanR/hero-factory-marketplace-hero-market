/**
 * Policy tuning workbench — composes existing policy simulations (dry-run only).
 */

import type { AutonomousPolicyRow } from "@/lib/revenue-os/autonomous-policies-db";
import { listAutonomousPoliciesForUser } from "@/lib/revenue-os/autonomous-policies-db";
import { listAutomationPoliciesForUser } from "@/lib/revenue-os/automation-policies-db";
import type { BentleyAutonomousCandidate } from "@/lib/revenue-os/autonomous-candidates";
import type { EvaluateBentleyAutonomousThresholdsInput } from "@/lib/revenue-os/autonomous-thresholds";
import { fetchDistributionQueueState } from "@/lib/revenue-os/distribution-queue-actions";
import { buildBentleyOperatorOverview } from "@/lib/revenue-os/operator-intelligence";
import {
  simulateBentleyAutonomousPolicies,
  simulateBentleyCadencePolicies,
  simulateBentleyNotificationPolicies,
  type AutonomousPolicyPatch,
  type AutonomousPolicySimulationResult,
  type CadencePolicySimulationResult,
  type NotificationPolicySimulationResult,
} from "@/lib/revenue-os/policy-simulation";
import type { BentleyPolicyScenarioType } from "@/lib/revenue-os/policy-scenarios-db";
import { generateBentleyPolicyRecommendations } from "@/lib/revenue-os/policy-recommendations";
import { compareBentleySimulationAgainstCurrent, type BentleySimulationComparison } from "@/lib/revenue-os/simulation-comparator";
import { listNotificationPoliciesForUser } from "@/lib/revenue-os/notification-db";

export type BentleyPolicyProposedSnapshot = {
  autonomous?: {
    policyPatchesById?: Record<string, Record<string, unknown>>;
    pairs?: Array<{
      candidate: {
        actionType: string;
        scope: { clientId: string; trustId: string };
        reason?: string;
        riskLevel: "low" | "medium" | "high" | "critical";
        confidence: number;
        sourceSystem?: string;
        targetIds: string[];
        estimatedImpact?: string;
        queueId?: string;
      };
      context: {
        hasOpenBlockingIssue: boolean;
        connectorReady: boolean;
        recentFailuresForTarget: number;
        executionsToday: number;
        policyCooldownActive: boolean;
        workspacePriorityRank?: number;
      };
    }>;
  };
  cadence?: {
    staleDaysCurrent?: number;
    staleDaysProposed?: number;
    promotedWinnersSkippingApproval?: boolean;
  };
  notifications?: {
    minSeverityProposed?: "info" | "warning" | "critical";
  };
};

export type BentleyPolicyWorkbenchBuild = {
  currentPoliciesSummary: string;
  autonomousPolicyCount: number;
  automationPolicyCount: number;
  notificationPolicyCount: number;
  basePolicySnapshotJson: Record<string, unknown>;
  empty: boolean;
};

export type BentleyPolicyScenarioRunResult = {
  baselineSummary: string;
  proposedSummary: string;
  deltaSummary: string;
  riskSummary: { lines: string[]; riskFlags: string[] };
  recommendation: { title: string; body: string; confidence: "low" | "medium" | "high"; humanReviewAdvised: boolean };
  suggestedNextChange: string;
  dryRun: true;
  scenarioType: BentleyPolicyScenarioType;
  autonomous: AutonomousPolicySimulationResult | null;
  cadence: CadencePolicySimulationResult | null;
  notifications: NotificationPolicySimulationResult | null;
  comparison: BentleySimulationComparison;
  recommendations: ReturnType<typeof generateBentleyPolicyRecommendations>;
  partialReasons: string[];
};

function serializePoliciesSnapshot(input: {
  autonomous: AutonomousPolicyRow[];
  automation: Awaited<ReturnType<typeof listAutomationPoliciesForUser>>;
  notifications: Awaited<ReturnType<typeof listNotificationPoliciesForUser>>;
}): Record<string, unknown> {
  return {
    autonomous: input.autonomous.map((p) => ({
      id: p.id,
      actionType: p.actionType,
      isEnabled: p.isEnabled,
      requiresApprovalAboveSeverity: p.requiresApprovalAboveSeverity,
      maxDailyExecutions: p.maxDailyExecutions,
      cooldownMinutes: p.cooldownMinutes,
      policyConfigJson: p.policyConfigJson,
    })),
    automation: input.automation.map((p) => ({
      id: p.id,
      policyType: p.policyType,
      isEnabled: p.isEnabled,
      policyConfigJson: p.policyConfigJson,
    })),
    notifications: input.notifications.map((p) => ({
      id: p.id,
      eventType: p.eventType,
      minimumSeverity: p.minimumSeverity,
      isEnabled: p.isEnabled,
    })),
  };
}

export async function buildBentleyPolicyWorkbench(input: {
  userId: string;
  clientId?: string | null;
  trustId?: string | null;
}): Promise<BentleyPolicyWorkbenchBuild> {
  const uid = String(input.userId).trim();
  if (!uid) {
    return {
      currentPoliciesSummary: "No operator context.",
      autonomousPolicyCount: 0,
      automationPolicyCount: 0,
      notificationPolicyCount: 0,
      basePolicySnapshotJson: {},
      empty: true,
    };
  }
  const [autonomous, automation, notifications] = await Promise.all([
    listAutonomousPoliciesForUser({
      userId: uid,
      clientId: input.clientId ?? undefined,
      trustId: input.trustId ?? undefined,
    }),
    listAutomationPoliciesForUser({
      userId: uid,
      clientId: input.clientId ?? undefined,
      trustId: input.trustId ?? undefined,
    }),
    listNotificationPoliciesForUser({
      userId: uid,
      clientId: input.clientId ?? undefined,
      trustId: input.trustId ?? undefined,
    }),
  ]);

  const basePolicySnapshotJson = serializePoliciesSnapshot({ autonomous, automation, notifications });
  const empty = autonomous.length === 0 && automation.length === 0 && notifications.length === 0;
  const currentPoliciesSummary = [
    `${autonomous.length} autonomous action policy/policies`,
    `${automation.length} automation policy/policies`,
    `${notifications.length} notification routing policy/policies`,
  ].join("; ");

  return {
    currentPoliciesSummary,
    autonomousPolicyCount: autonomous.length,
    automationPolicyCount: automation.length,
    notificationPolicyCount: notifications.length,
    basePolicySnapshotJson,
    empty,
  };
}

function parseProposed(raw: unknown): BentleyPolicyProposedSnapshot {
  if (!raw || typeof raw !== "object") return {};
  return raw as BentleyPolicyProposedSnapshot;
}

export async function runBentleyPolicyScenario(input: {
  userId: string;
  clientId?: string | null;
  trustId?: string | null;
  scenarioType: BentleyPolicyScenarioType;
  proposedPolicySnapshotJson: unknown;
  basePolicySnapshotJson?: unknown;
}): Promise<BentleyPolicyScenarioRunResult> {
  const uid = String(input.userId).trim();
  const proposed = parseProposed(input.proposedPolicySnapshotJson);
  const partialReasons: string[] = [];

  let autonomous: AutonomousPolicySimulationResult | null = null;
  let cadence: CadencePolicySimulationResult | null = null;
  let notifications: NotificationPolicySimulationResult | null = null;

  const runAutonomous = input.scenarioType === "autonomous" || input.scenarioType === "blended";
  const runCadence =
    (input.scenarioType === "cadence" || input.scenarioType === "blended") &&
    Boolean(input.clientId?.trim() && input.trustId?.trim());
  const runNotif = input.scenarioType === "notifications" || input.scenarioType === "blended";

  if ((input.scenarioType === "cadence" || input.scenarioType === "blended") && !runCadence) {
    partialReasons.push("Cadence simulation skipped — clientId and trustId are required for queue-backed cadence.");
  }

  if (runAutonomous && uid) {
    const policiesCurrent = await listAutonomousPoliciesForUser({
      userId: uid,
      clientId: input.clientId ?? undefined,
      trustId: input.trustId ?? undefined,
    });
    const patches: Record<string, AutonomousPolicyPatch> = {};
    for (const [id, raw] of Object.entries(proposed.autonomous?.policyPatchesById ?? {})) {
      patches[id] = raw as AutonomousPolicyPatch;
    }
    const pairs = proposed.autonomous?.pairs ?? [];
    const candidates: BentleyAutonomousCandidate[] = pairs.map((p) => ({
      actionType: p.candidate.actionType as BentleyAutonomousCandidate["actionType"],
      scope: p.candidate.scope,
      reason: p.candidate.reason ?? "",
      riskLevel: p.candidate.riskLevel,
      confidence: p.candidate.confidence,
      sourceSystem: p.candidate.sourceSystem ?? "workbench",
      targetIds: p.candidate.targetIds,
      estimatedImpact: p.candidate.estimatedImpact ?? "",
      queueId: p.candidate.queueId,
    }));
    const contextByCandidateIndex: EvaluateBentleyAutonomousThresholdsInput["context"][] = pairs.map((p) => p.context);

    autonomous = simulateBentleyAutonomousPolicies({
      candidates,
      policiesCurrent,
      policyPatchesById: patches,
      contextByCandidateIndex,
    });
  }

  if (runCadence && uid && input.clientId?.trim() && input.trustId?.trim()) {
    const queueItems = await fetchDistributionQueueState({
      userId: uid,
      clientId: input.clientId!,
      trustId: input.trustId!,
      limit: 200,
    });
    cadence = simulateBentleyCadencePolicies({
      queueItems,
      staleDaysCurrent: proposed.cadence?.staleDaysCurrent,
      staleDaysProposed: proposed.cadence?.staleDaysProposed,
      promotedWinnersSkippingApproval: proposed.cadence?.promotedWinnersSkippingApproval,
    });
  }

  const overviewForRec =
    uid !== ""
      ? await buildBentleyOperatorOverview({
          userId: uid,
          clientIds: input.clientId ? [input.clientId] : undefined,
          trustIds: input.trustId ? [input.trustId] : undefined,
        })
      : null;

  if (runNotif && uid && overviewForRec) {
    const minSev = proposed.notifications?.minSeverityProposed ?? "warning";
    notifications = simulateBentleyNotificationPolicies({
      userId: uid,
      overview: overviewForRec,
      minSeverityProposed: minSev,
    });
  }

  const notifDelta =
    notifications != null ? notifications.eventsProposed - notifications.eventsCurrent : null;
  const queueDelta =
    cadence != null
      ? cadence.staleDraftsEligibleProposed -
          cadence.staleDraftsEligibleCurrent +
          (cadence.promoteWithoutApprovalDelta ?? 0)
      : null;

  const comparison = compareBentleySimulationAgainstCurrent({
    autonomous: autonomous ?? undefined,
    notificationEventsDelta: notifDelta,
    queueStateDelta: queueDelta,
  });

  const recommendations = generateBentleyPolicyRecommendations({
    comparison,
    autonomous,
    cadence,
    notifications,
    overview: overviewForRec,
  });

  const riskFlags = [
    ...(autonomous?.riskFlags ?? []),
    ...(cadence?.riskFlags ?? []),
    ...(notifications?.riskFlags ?? []),
  ];
  const riskLines = [
    comparison.summaryDelta,
    ...riskFlags,
  ].filter(Boolean);

  const baselineSummary = [
    autonomous ? `Autonomous baseline: ${autonomous.simulationSummary}` : "",
    cadence
      ? `Cadence baseline: ${cadence.staleDraftsEligibleCurrent} stale-draft eligible @ current threshold.`
      : "",
    notifications ? `Notifications baseline: ${notifications.eventsCurrent} event(s) before severity filter.` : "",
  ]
    .filter(Boolean)
    .join(" ") || "No simulations produced — add proposal details or scope.";

  const proposedSummary = [
    autonomous ? `Proposed autonomous: ${autonomous.changedOutcomes.length} outcome flip(s).` : "",
    cadence ? `Proposed cadence: ${cadence.staleDraftsEligibleProposed} stale-draft eligible; promote bypass count ${cadence.promoteWithoutApprovalDelta}.` : "",
    notifications ? `Proposed notifications: ${notifications.eventsProposed} event(s); ${notifications.droppedBySeverityFilter} dropped by filter.` : "",
  ]
    .filter(Boolean)
    .join(" ") || "Proposal snapshot did not change simulated dimensions.";

  const deltaSummary = comparison.summaryDelta;
  const top = recommendations[0];
  const recommendation = {
    title: top.title,
    body: `${top.expectedBenefit} ${top.expectedRisk}`.slice(0, 1200),
    confidence: (top.humanReviewStronglyAdvised ? "low" : "high") as "low" | "medium" | "high",
    humanReviewAdvised: top.humanReviewStronglyAdvised,
  };
  if (recommendations.length > 1 && recommendations.some((r) => r.humanReviewStronglyAdvised)) {
    recommendation.confidence = "medium";
  }

  const suggestedNextChange =
    recommendations.find((r) => r.id !== "neutral")?.title ??
    "Refine proposed patches or add candidate pairs for autonomous simulation.";

  return {
    baselineSummary,
    proposedSummary,
    deltaSummary,
    riskSummary: { lines: riskLines.length ? riskLines : ["No material risk flags in this dry-run."], riskFlags },
    recommendation,
    suggestedNextChange,
    dryRun: true,
    scenarioType: input.scenarioType,
    autonomous,
    cadence,
    notifications,
    comparison,
    recommendations,
    partialReasons,
  };
}

export function recommendBentleyPolicyAdjustment(input: {
  run: Pick<BentleyPolicyScenarioRunResult, "recommendations" | "comparison" | "riskSummary">;
}): {
  primary: ReturnType<typeof generateBentleyPolicyRecommendations>[0];
  alternates: ReturnType<typeof generateBentleyPolicyRecommendations>;
} {
  const alts = input.run.recommendations;
  const primary = alts[0];
  return { primary, alternates: alts };
}
