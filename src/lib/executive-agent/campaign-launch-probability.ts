import {
  FULFILLMENT_PRIMARY_SERVICE_REVENUE_OS,
} from "@/lib/fulfillment/fulfillment-types";
import type {
  CampaignLaunchProbabilityResult,
  ExecutiveSimulationEngineInput,
} from "@/lib/executive-agent/executive-simulation-types";

export function modelCampaignLaunchProbability(
  input: ExecutiveSimulationEngineInput
): CampaignLaunchProbabilityResult {
  const revenueOrders = input.kpi.snapshots.filter(
    (o) => o.department === FULFILLMENT_PRIMARY_SERVICE_REVENUE_OS && o.pipelineStage !== "closed"
  );
  const kpiOutcomes = input.kpi.outcomes.filter((o) => o.department === FULFILLMENT_PRIMARY_SERVICE_REVENUE_OS);

  let score = 72;
  const factors: string[] = [];

  for (const o of revenueOrders) {
    if (!o.campaignId) {
      score -= 12;
      factors.push("Missing campaign linkage on order");
    }
    if (!o.launchReadinessApproved && o.pipelineStage === "approved_for_release") {
      score -= 10;
      factors.push("Launch readiness checkpoint not recorded");
    }
    if (o.approvalStatus === "pending") {
      score -= 8;
      factors.push("Pending executive approval");
    }
    if (o.daysInCurrentStage >= 7) {
      score -= 6;
      factors.push("Stalled in stage");
    }
  }

  for (const out of kpiOutcomes) {
    if (out.outcome === "revenue_os_kpi_watch") {
      score -= 5;
      factors.push("KPI watch outcome in memory");
    }
    if (out.outcome === "revenue_os_campaign_stalled") {
      score -= 15;
      factors.push("Campaign stalled outcome in memory");
    }
  }

  score = Math.max(5, Math.min(95, score));
  const launchSuccessProbability = score / 100;
  const atRiskProbability = 1 - launchSuccessProbability;

  return {
    ordersAnalyzed: revenueOrders.length,
    launchSuccessProbability: Math.round(launchSuccessProbability * 100) / 100,
    atRiskProbability: Math.round(atRiskProbability * 100) / 100,
    confidence: revenueOrders.length >= 2 ? "medium" : "low",
    factors: [...new Set(factors)].slice(0, 6),
    evidence: [
      { source: "snapshots", detail: `${revenueOrders.length} REVENUE_OS order(s)` },
      { source: "memory", detail: `${kpiOutcomes.length} revenue outcome(s) in memory store` },
    ],
    advisoryOnly: true,
  };
}
