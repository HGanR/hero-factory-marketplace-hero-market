import type {
  ExecutiveSimulationEngineInput,
  OperatorRedistributionSimulationResult,
} from "@/lib/executive-agent/executive-simulation-types";
import { detectOverloadedOperators } from "@/lib/executive-agent/operator-workload-service";

export function simulateOperatorRedistribution(
  input: ExecutiveSimulationEngineInput
): OperatorRedistributionSimulationResult[] {
  const overloaded = detectOverloadedOperators(input.operatorWorkload);
  const underloaded = input.operatorWorkload.filter(
    (w) => w.balanceLabel === "underloaded" || w.balanceLabel === "balanced"
  );
  if (!overloaded.length || !underloaded.length) return [];

  const from = overloaded[0]!;
  const to = underloaded.sort((a, b) => a.loadIndex - b.loadIndex)[0]!;
  const tasksToMove = Math.min(
    Math.ceil(from.openTasks * 0.25),
    Math.max(1, Math.floor((to.loadIndex + 15) / 10))
  );

  return [
    {
      fromOperatorId: from.operatorId,
      toOperatorId: to.operatorId,
      tasksRedistributed: tasksToMove,
      projectedLoadDelta: Math.round(from.loadIndex * 0.15),
      confidence: from.overdueTasks > 0 ? "medium" : "low",
      rationale: `Simulated owner-approved redistribution only — ${tasksToMove} task(s) from ${from.label} to ${to.label}; no autonomous reassignment.`,
      evidence: [
        { source: "operator_workload", detail: `${from.label} load ${from.loadIndex}` },
        { source: "assumption", detail: "Advisory simulation — production workload unchanged" },
      ],
      advisoryOnly: true,
    },
  ];
}
