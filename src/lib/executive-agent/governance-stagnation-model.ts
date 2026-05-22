import { FULFILLMENT_PRIMARY_SERVICE_SMART_TRUST } from "@/lib/fulfillment/fulfillment-types";
import type {
  ExecutiveSimulationEngineInput,
  GovernanceStagnationModelResult,
} from "@/lib/executive-agent/executive-simulation-types";

export function modelGovernanceStagnation(
  input: ExecutiveSimulationEngineInput
): GovernanceStagnationModelResult {
  const smartTrustOrders = input.kpi.snapshots.filter(
    (o) => o.department === FULFILLMENT_PRIMARY_SERVICE_SMART_TRUST && o.pipelineStage !== "released"
  );
  const outcomes = input.kpi.outcomes.filter((o) => o.department === FULFILLMENT_PRIMARY_SERVICE_SMART_TRUST);

  let stagnationScore = 0.2;
  for (const o of smartTrustOrders) {
    if (!o.governanceReviewApproved && (o.governanceReviewRound ?? 0) > 0) stagnationScore += 0.15;
    if (o.daysInCurrentStage >= 7) stagnationScore += 0.12;
    if (o.approvalStatus === "pending") stagnationScore += 0.1;
    if (!o.trustId) stagnationScore += 0.08;
  }
  for (const out of outcomes) {
    if (out.outcome === "smart_trust_governance_stalled") stagnationScore += 0.2;
    if (out.outcome === "smart_trust_governance_blocked") stagnationScore += 0.25;
    if (out.outcome === "smart_trust_compliance_watch") stagnationScore += 0.1;
  }

  stagnationScore = Math.min(0.95, stagnationScore);
  const avgDays =
    smartTrustOrders.length > 0
      ? smartTrustOrders.reduce((s, o) => s + o.daysInCurrentStage, 0) / smartTrustOrders.length
      : 0;

  return {
    smartTrustOrders: smartTrustOrders.length,
    stagnationProbability: Math.round(stagnationScore * 100) / 100,
    avgDaysToResolution: Math.round(avgDays + stagnationScore * 14),
    confidence: smartTrustOrders.length >= 1 ? "medium" : "low",
    evidence: [
      { source: "snapshots", detail: `${smartTrustOrders.length} SMART_TRUST active order(s)` },
      { source: "memory", detail: `${outcomes.length} governance-related outcome(s)` },
    ],
    advisoryOnly: true,
  };
}
