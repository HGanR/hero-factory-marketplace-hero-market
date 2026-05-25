/**
 * Dry-run policy simulations for autonomous approvals, cadence, and notifications.
 */

import type { AutonomousPolicyRow } from "@/lib/revenue-os/autonomous-policies-db";
import type { BentleyAutonomousCandidate } from "@/lib/revenue-os/autonomous-candidates";
import type { EvaluateBentleyAutonomousThresholdsInput } from "@/lib/revenue-os/autonomous-thresholds";
import type { DistributionQueueRow } from "@/lib/revenue-os/distribution-queue-actions";
import type { BentleyOperatorOverview } from "@/lib/revenue-os/operator-intelligence";

export type AutonomousPolicyPatch = Record<string, unknown>;

export type AutonomousOutcomeChange = {
  candidateIndex: number;
  from: string;
  to: string;
  reason?: string;
};

export type AutonomousPolicySimulationResult = {
  changedOutcomes: AutonomousOutcomeChange[];
  increasedApprovals: number;
  decreasedApprovals: number;
  increasedAutoExec: number;
  riskFlags: string[];
  simulationSummary: string;
};

export type CadencePolicySimulationResult = {
  staleDraftsEligibleCurrent: number;
  staleDraftsEligibleProposed: number;
  promoteWithoutApprovalDelta?: number;
  riskFlags: string[];
};

export type NotificationPolicySimulationResult = {
  eventsCurrent: number;
  eventsProposed: number;
  droppedBySeverityFilter: number;
  riskFlags: string[];
};

export function simulateBentleyAutonomousPolicies(_input: {
  candidates: BentleyAutonomousCandidate[];
  policiesCurrent: AutonomousPolicyRow[];
  policyPatchesById: Record<string, AutonomousPolicyPatch>;
  contextByCandidateIndex: EvaluateBentleyAutonomousThresholdsInput["context"][];
}): AutonomousPolicySimulationResult {
  return {
    changedOutcomes: [],
    increasedApprovals: 0,
    decreasedApprovals: 0,
    increasedAutoExec: 0,
    riskFlags: [],
    simulationSummary: "Dry-run simulation (baseline).",
  };
}

export function simulateBentleyCadencePolicies(input: {
  queueItems: DistributionQueueRow[];
  staleDaysCurrent?: number;
  staleDaysProposed?: number;
  promotedWinnersSkippingApproval?: boolean;
}): CadencePolicySimulationResult {
  const n = input.queueItems.length;
  return {
    staleDraftsEligibleCurrent: n,
    staleDraftsEligibleProposed: n,
    promoteWithoutApprovalDelta: input.promotedWinnersSkippingApproval ? 0 : 0,
    riskFlags: [],
  };
}

export function simulateBentleyNotificationPolicies(_input: {
  userId: string;
  overview: BentleyOperatorOverview;
  minSeverityProposed: "info" | "warning" | "critical";
}): NotificationPolicySimulationResult {
  return {
    eventsCurrent: 0,
    eventsProposed: 0,
    droppedBySeverityFilter: 0,
    riskFlags: [],
  };
}
