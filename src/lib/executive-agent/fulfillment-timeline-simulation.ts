import type {
  ExecutiveSimulationEngineInput,
  FulfillmentTimelineSimulationResult,
  SimulationEvidenceLink,
} from "@/lib/executive-agent/executive-simulation-types";
import { buildFulfillmentVelocitySnapshot } from "@/lib/fulfillment/executive-kpi-engine";

export function simulateFulfillmentTimeline(
  input: ExecutiveSimulationEngineInput,
  opts?: { horizonDays?: number; approvalDelayHours?: number }
): FulfillmentTimelineSimulationResult {
  const horizon = opts?.horizonDays ?? 14;
  const active = input.kpi.snapshots.filter(
    (o) => o.pipelineStage !== "released" && o.pipelineStage !== "closed"
  );
  const velocity = buildFulfillmentVelocitySnapshot(input.kpi.snapshots);
  const approvalBoost = (opts?.approvalDelayHours ?? 0) / 24;

  const dayEstimates = active.map((o) => {
    const base = Math.max(1, Math.round(o.daysInCurrentStage * 0.7 + (100 - velocity.velocityScore) / 15));
    const pending = o.approvalStatus === "pending" ? 3 + approvalBoost : 0;
    const revision = (o.revisionRound ?? 0) >= 2 ? 4 : 0;
    return Math.min(horizon + 7, base + pending + revision);
  });

  dayEstimates.sort((a, b) => a - b);
  const median =
    dayEstimates.length === 0
      ? 0
      : dayEstimates[Math.floor(dayEstimates.length / 2)] ?? 0;
  const p90 =
    dayEstimates.length === 0
      ? 0
      : dayEstimates[Math.floor(dayEstimates.length * 0.9)] ?? median;

  const stalledProjected = active.filter((o) => o.daysInCurrentStage >= 5).length;
  const confidence =
    active.length >= 8 ? "high" : active.length >= 3 ? "medium" : "low";

  const evidence: SimulationEvidenceLink[] = [
    { source: "snapshots", detail: `${active.length} active fulfillment orders` },
    { source: "forecast", detail: velocity.evidence },
  ];
  if (approvalBoost > 0) {
    evidence.push({
      source: "assumption",
      detail: `+${opts?.approvalDelayHours}h approval delay stress applied`,
    });
  }

  return {
    medianCompletionDays: median,
    p90CompletionDays: p90,
    ordersSimulated: active.length,
    stalledProjected,
    confidence,
    confidenceScore: confidence === "high" ? 0.82 : confidence === "medium" ? 0.58 : 0.35,
    evidence,
    advisoryOnly: true,
  };
}
