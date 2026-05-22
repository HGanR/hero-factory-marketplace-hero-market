import type { ClientHealthTier } from "@/lib/fulfillment/fulfillment-orchestration-types";
import type {
  DepartmentWorkloadSnapshot,
  ExecutiveKpiEngineInput,
  FulfillmentVelocitySnapshot,
  OperationalHealthScoreDto,
} from "@/lib/fulfillment/executive-kpi-forecast-types";

function tierFromScore(score: number): ClientHealthTier {
  if (score < 40) return "critical";
  if (score < 58) return "at_risk";
  if (score < 75) return "steady";
  return "healthy";
}

export function computeDeskOperationalHealthScore(input: {
  velocity: FulfillmentVelocitySnapshot;
  workload: DepartmentWorkloadSnapshot[];
  stalledOrders: number;
  pendingApprovals: number;
  criticalClients: number;
  atRiskClients: number;
}): OperationalHealthScoreDto {
  let score = 82;
  const factors: OperationalHealthScoreDto["factors"] = [];

  if (input.velocity.stalledCount > 0) {
    const impact = Math.min(28, input.velocity.stalledCount * 4);
    score -= impact;
    factors.push({
      key: "stalled_velocity",
      label: "Stalled fulfillment orders",
      impact: -impact,
      detail: `${input.velocity.stalledCount} order(s) stalled ≥7d in stage`,
    });
  }

  if (input.pendingApprovals > 0) {
    const impact = Math.min(18, input.pendingApprovals * 3);
    score -= impact;
    factors.push({
      key: "approval_backlog",
      label: "Pending executive approvals",
      impact: -impact,
      detail: `${input.pendingApprovals} approval(s) awaiting owner action`,
    });
  }

  const overloaded = input.workload.filter((w) => w.balanceLabel === "overloaded").length;
  if (overloaded > 0) {
    const impact = overloaded * 8;
    score -= impact;
    factors.push({
      key: "department_overload",
      label: "Overloaded departments",
      impact: -impact,
      detail: `${overloaded} department(s) above balanced load index`,
    });
  }

  if (input.criticalClients > 0) {
    const impact = Math.min(20, input.criticalClients * 6);
    score -= impact;
    factors.push({
      key: "critical_clients",
      label: "Critical client health",
      impact: -impact,
      detail: `${input.criticalClients} client(s) in critical tier`,
    });
  }

  if (input.atRiskClients > 0) {
    const impact = Math.min(12, input.atRiskClients * 2);
    score -= impact;
    factors.push({
      key: "at_risk_clients",
      label: "At-risk clients",
      impact: -impact,
      detail: `${input.atRiskClients} client(s) in at_risk tier`,
    });
  }

  if (input.velocity.velocityScore >= 70) {
    factors.push({
      key: "velocity_positive",
      label: "Fulfillment velocity",
      impact: 6,
      detail: `Velocity score ${input.velocity.velocityScore} — majority progressing`,
    });
    score = Math.min(100, score + 4);
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  const tier = tierFromScore(score);

  return {
    score,
    tier,
    factors,
    evidenceSummary: `Desk health ${score}/100 (${tier}) from ${input.velocity.ordersAnalyzed} active fulfillment order(s); forecasting advisory only.`,
  };
}

export function summarizeHealthByTier(
  healthByClient: ExecutiveKpiEngineInput["healthByClient"]
): Record<ClientHealthTier, number> {
  const out: Record<ClientHealthTier, number> = {
    critical: 0,
    at_risk: 0,
    steady: 0,
    healthy: 0,
  };
  for (const h of healthByClient) {
    out[h.tier] += 1;
  }
  return out;
}
