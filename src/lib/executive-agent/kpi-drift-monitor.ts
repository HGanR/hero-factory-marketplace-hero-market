import type {
  ExecutiveCommandEngineInput,
  KpiDriftMonitorResult,
} from "@/lib/executive-agent/executive-command-types";

export function monitorKpiDrift(input: ExecutiveCommandEngineInput): KpiDriftMonitorResult {
  const snapshots = input.kpi.snapshots;
  const active = snapshots.filter(
    (s) => s.pipelineStage !== "released" && s.pipelineStage !== "closed"
  );
  const stalled = active.filter((s) => s.daysInCurrentStage >= 10);
  const pending = active.filter((s) => s.approvalStatus === "pending");

  const driftSignals: KpiDriftMonitorResult["driftSignals"] = [];

  const stallRate = active.length ? stalled.length / active.length : 0;
  if (stallRate > 0.25) {
    driftSignals.push({
      metric: "stall_rate",
      direction: "worsening",
      detail: `${Math.round(stallRate * 100)}% of active orders stalled (≥10d)`,
    });
  }

  if (pending.length >= 3) {
    driftSignals.push({
      metric: "approval_backlog",
      direction: "worsening",
      detail: `${pending.length} pending approval gates`,
    });
  }

  const bottlenecks = input.kpi.bottlenecks.length;
  if (bottlenecks >= 2) {
    driftSignals.push({
      metric: "bottleneck_count",
      direction: "worsening",
      detail: `${bottlenecks} KPI bottleneck record(s)`,
    });
  }

  const atRisk = input.kpi.healthByClient.filter((h) => h.tier === "at_risk" || h.tier === "critical").length;
  if (atRisk >= 2) {
    driftSignals.push({
      metric: "client_health",
      direction: "worsening",
      detail: `${atRisk} client(s) at risk or critical`,
    });
  }

  if (driftSignals.length === 0) {
    driftSignals.push({
      metric: "desk_velocity",
      direction: "stable",
      detail: "No significant KPI drift detected in current window",
    });
  }

  const driftScore = Math.min(1, driftSignals.filter((d) => d.direction === "worsening").length * 0.22);

  return {
    driftSignals,
    driftScore: Math.round(driftScore * 100) / 100,
    confidence: driftSignals.some((d) => d.direction === "worsening") ? "medium" : "low",
    evidence: [{ source: "kpi", detail: `${active.length} active orders analyzed` }],
    advisoryOnly: true,
  };
}
