import type {
  CampaignDegradationResult,
  ExecutiveCommandEngineInput,
} from "@/lib/executive-agent/executive-command-types";

export function monitorCampaignDegradation(
  input: ExecutiveCommandEngineInput
): CampaignDegradationResult {
  const revenue = input.kpi.snapshots.filter((s) => s.department === "REVENUE_OS");
  const atRisk = revenue.filter(
    (s) =>
      s.approvalStatus === "pending" ||
      s.daysInCurrentStage >= 10 ||
      s.pipelineStage.includes("revision") ||
      s.pipelineStage.includes("blocked")
  );

  const degradationSignals: string[] = [];
  if (atRisk.length > 0) {
    degradationSignals.push(`${atRisk.length} REVENUE_OS order(s) show launch/review friction`);
  }
  const pendingLaunch = revenue.filter((s) => s.approvalStatus === "pending");
  if (pendingLaunch.length >= 2) {
    degradationSignals.push("Campaign approval backlog — launch readiness at risk");
  }
  const stalledCampaign = revenue.filter((s) => s.daysInCurrentStage >= 12);
  if (stalledCampaign.length >= 1) {
    degradationSignals.push(`${stalledCampaign.length} campaign order(s) stalled ≥12d`);
  }

  return {
    atRiskOrders: atRisk.length,
    degradationSignals,
    confidence: atRisk.length >= 2 ? "high" : atRisk.length >= 1 ? "medium" : "low",
    evidence: [{ source: "snapshots", detail: `${revenue.length} REVENUE_OS order(s) monitored` }],
    advisoryOnly: true,
  };
}
