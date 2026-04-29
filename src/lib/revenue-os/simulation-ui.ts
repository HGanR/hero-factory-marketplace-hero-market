/**
 * UI-ready simulation comparison tables and before/after summaries.
 */

import type {
  AutonomousPolicySimulationResult,
  CadencePolicySimulationResult,
  NotificationPolicySimulationResult,
} from "@/lib/revenue-os/policy-simulation";
import type { BentleySimulationComparison } from "@/lib/revenue-os/simulation-comparator";

export type SimulationComparisonTableRow = {
  dimension: string;
  before: string;
  after: string;
  delta: string;
};

export function buildSimulationComparisonTablePayload(input: {
  autonomous?: AutonomousPolicySimulationResult | null;
  cadence?: CadencePolicySimulationResult | null;
  notifications?: NotificationPolicySimulationResult | null;
}): { rows: SimulationComparisonTableRow[]; headline: string } {
  const rows: SimulationComparisonTableRow[] = [];
  if (input.autonomous) {
    rows.push({
      dimension: "Autonomous approvals required",
      before: "—",
      after: `+${input.autonomous.increasedApprovals} / -${input.autonomous.decreasedApprovals}`,
      delta: `${input.autonomous.changedOutcomes.length} outcome flips`,
    });
    rows.push({
      dimension: "Autonomous auto-execute",
      before: "—",
      after: `+${input.autonomous.increasedAutoExec}`,
      delta: "vs baseline evaluation",
    });
  }
  if (input.cadence) {
    rows.push({
      dimension: "Stale drafts eligible (archive)",
      before: String(input.cadence.staleDraftsEligibleCurrent),
      after: String(input.cadence.staleDraftsEligibleProposed),
      delta: String(input.cadence.staleDraftsEligibleProposed - input.cadence.staleDraftsEligibleCurrent),
    });
  }
  if (input.notifications) {
    rows.push({
      dimension: "Notification events (severity filter)",
      before: String(input.notifications.eventsCurrent),
      after: String(input.notifications.eventsProposed),
      delta: `-${input.notifications.droppedBySeverityFilter}`,
    });
  }
  return {
    rows,
    headline: "Before vs after (simulation — no production changes)",
  };
}

export function buildPolicyDeltaRiskPanel(input: {
  comparison: BentleySimulationComparison;
  autonomousRiskFlags?: string[];
}): { title: string; lines: string[] } {
  const lines = [
    input.comparison.summaryDelta,
    ...(input.autonomousRiskFlags ?? []),
  ].filter(Boolean);
  return {
    title: "Policy delta risk",
    lines: lines.length ? lines : ["No material delta detected."],
  };
}
