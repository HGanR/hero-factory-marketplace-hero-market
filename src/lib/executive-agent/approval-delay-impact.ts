import type {
  ApprovalDelayImpactResult,
  ExecutiveSimulationEngineInput,
} from "@/lib/executive-agent/executive-simulation-types";

export function simulateApprovalDelayImpact(
  input: ExecutiveSimulationEngineInput,
  additionalHours: number
): ApprovalDelayImpactResult {
  const pending = input.kpi.snapshots.filter((o) => o.approvalStatus === "pending");
  const departments = [...new Set(pending.map((o) => o.department))];
  const medianLatency =
    input.kpi.approvalLatency.length > 0
      ? input.kpi.approvalLatency.reduce((s, l) => s + (l.medianHoursToExecute ?? 48), 0) /
        input.kpi.approvalLatency.length
      : 48;

  const projectedDeskDelayDays = Math.round(
    (pending.length * (medianLatency + additionalHours)) / 24 / Math.max(1, pending.length || 1)
  );

  const sampleCount = input.kpi.approvalLatency.reduce((s, l) => s + l.sampleCount, 0);
  const confidence =
    sampleCount >= 4 && pending.length > 0 ? "high" : pending.length > 0 ? "medium" : "low";

  return {
    pendingApprovals: pending.length,
    additionalHours,
    projectedDeskDelayDays: Math.max(projectedDeskDelayDays, Math.round(additionalHours / 24)),
    affectedDepartments: departments,
    confidence,
    evidence: [
      { source: "snapshots", detail: `${pending.length} pending approval(s) on desk` },
      {
        source: "memory",
        detail:
          input.kpi.approvalLatency.length > 0
            ? `Historical median ~${Math.round(medianLatency)}h`
            : "Limited approval latency history",
      },
      { source: "assumption", detail: `+${additionalHours}h simulated delay` },
    ],
    advisoryOnly: true,
  };
}
