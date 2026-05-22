import type {
  EscalationImpactSimulationResult,
  ExecutiveSimulationEngineInput,
} from "@/lib/executive-agent/executive-simulation-types";
import { buildEscalationRiskAlerts } from "@/lib/executive-agent/executive-escalation-intelligence";
import { parseTaskCoordinationMetadata } from "@/lib/executive-agent/operator-task-metadata";

export function simulateEscalationImpact(
  input: ExecutiveSimulationEngineInput,
  levelDelta = 0
): EscalationImpactSimulationResult {
  const metadata = input.metadataByTaskId;
  const alerts = buildEscalationRiskAlerts({
    tasks: input.tasks,
    workload: input.operatorWorkload,
    metadataByTaskId: metadata,
  });

  const highSeverity = alerts.filter((a) => a.severity === "high").length;
  const escalationsProjected = alerts.length + Math.max(0, levelDelta);
  const executiveOwnerInvolvementProbability = Math.min(
    0.95,
    0.15 + highSeverity * 0.12 + levelDelta * 0.08
  );
  const avgLevelsClimbed =
    alerts.length > 0
      ? alerts.reduce((s, a) => s + a.chainLevel, 0) / alerts.length
      : 1 + levelDelta;

  const pendingProposed = input.tasks.filter((t) => {
    const m = metadata.get(t.id);
    return m?.escalation?.status === "proposed";
  }).length;

  return {
    escalationsProjected,
    executiveOwnerInvolvementProbability: Math.round(executiveOwnerInvolvementProbability * 100) / 100,
    avgLevelsClimbed: Math.round(avgLevelsClimbed * 10) / 10,
    confidence: alerts.length >= 2 ? "medium" : "low",
    evidence: [
      { source: "operator_workload", detail: `${alerts.length} escalation risk alert(s)` },
      { source: "snapshots", detail: `${pendingProposed} escalation proposal(s) pending approval` },
      ...(levelDelta > 0
        ? [{ source: "assumption" as const, detail: `+${levelDelta} escalation level stress` }]
        : []),
    ],
    advisoryOnly: true,
  };
}
