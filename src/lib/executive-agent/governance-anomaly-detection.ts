import type {
  ExecutiveCommandEngineInput,
  GovernanceAnomalyResult,
} from "@/lib/executive-agent/executive-command-types";

export function detectGovernanceAnomalies(
  input: ExecutiveCommandEngineInput
): GovernanceAnomalyResult {
  const smartTrust = input.kpi.snapshots.filter((s) => s.department === "SMART_TRUST");
  const anomalies: GovernanceAnomalyResult["anomalies"] = [];

  for (const s of smartTrust) {
    if (s.approvalStatus === "pending" && s.daysInCurrentStage >= 7) {
      anomalies.push({
        id: `gov:${s.orderId}`,
        summary: `Governance approval pending ${s.daysInCurrentStage}d at ${s.pipelineStage}`,
        severity: s.daysInCurrentStage >= 12 ? "critical" : "high",
        department: "SMART_TRUST",
      });
    }
    if (!s.trustId && s.daysInCurrentStage >= 5) {
      anomalies.push({
        id: `gov:unlinked:${s.orderId}`,
        summary: "SMART_TRUST order without linked trustId — governance intake gap",
        severity: "medium",
        department: "SMART_TRUST",
      });
    }
  }

  const planningRuns = input.auditActionTypes.filter((a) => a.includes("planning")).length;
  if (planningRuns >= 5 && anomalies.length >= 2) {
    anomalies.push({
      id: "gov:desk_pressure",
      summary: "Elevated planning activity coinciding with governance delays",
      severity: "watch",
      department: "SMART_TRUST",
    });
  }

  return {
    anomalies: anomalies.slice(0, 12),
    anomalyCount: anomalies.length,
    confidence: anomalies.length >= 3 ? "high" : anomalies.length >= 1 ? "medium" : "low",
    evidence: [
      { source: "snapshots", detail: `${smartTrust.length} SMART_TRUST snapshot(s)` },
      { source: "audit", detail: "Governance desk audit patterns" },
    ],
    advisoryOnly: true,
  };
}
