import { randomUUID } from "crypto";
import { buildApprovalDelayForecasts } from "@/lib/fulfillment/approval-delay-forecast";
import { buildBottleneckForecasts } from "@/lib/fulfillment/bottleneck-forecasting";
import { buildDepartmentWorkloadBalance } from "@/lib/fulfillment/department-workload-balance";
import type {
  ExecutiveKpiEngineInput,
  ExecutiveKpiForecastDto,
  ForecastConfidence,
  FulfillmentDelayForecast,
} from "@/lib/fulfillment/executive-kpi-forecast-types";
import { buildExecutiveKpiOverviewFromEngine, buildFulfillmentVelocitySnapshot } from "@/lib/fulfillment/executive-kpi-engine";
import { buildForecastedRiskAlerts } from "@/lib/fulfillment/forecasted-risk-alerts";
import {
  computeDeskOperationalHealthScore,
} from "@/lib/fulfillment/operational-health-score";
import { buildRevisionRiskForecasts } from "@/lib/fulfillment/revision-risk-forecast";
import type { FulfillmentRecommendation } from "@/lib/fulfillment/fulfillment-orchestration-types";
import { detectOperationalBottlenecks } from "@/lib/fulfillment/fulfillment-recommendation-engine";

const STALL_DAYS = 7;

function delayConfidence(days: number, stallLikelihood: number): ForecastConfidence {
  if (days >= 10 && stallLikelihood >= 70) return "high";
  if (days >= 7 || stallLikelihood >= 50) return "medium";
  return "low";
}

export function buildFulfillmentDelayForecasts(
  snapshots: ExecutiveKpiEngineInput["snapshots"]
): FulfillmentDelayForecast[] {
  const active = snapshots.filter(
    (o) => o.pipelineStage !== "released" && o.pipelineStage !== "closed"
  );

  return active
    .map((o) => {
      const stallLikelihood = Math.min(
        95,
        o.daysInCurrentStage * 10 +
          (o.approvalStatus === "pending" ? 15 : 0) +
          ((o.revisionRound ?? 0) >= 2 ? 12 : 0) +
          (o.ownerReviewStatus === "pending" ? 10 : 0)
      );
      const projectedDelayDays = Math.max(
        0,
        Math.round(o.daysInCurrentStage * 0.6 + stallLikelihood / 12)
      );
      return {
        orderId: o.orderId,
        clientId: o.clientId,
        department: o.department,
        projectedDelayDays,
        stallLikelihood,
        confidence: delayConfidence(projectedDelayDays, stallLikelihood),
        rationale:
          o.daysInCurrentStage >= STALL_DAYS
            ? `Already ${o.daysInCurrentStage}d in ${o.pipelineStage} — high stall likelihood (${stallLikelihood}%).`
            : `Projected slowdown in ${o.department} if stage holds beyond ${STALL_DAYS}d.`,
      };
    })
    .filter((f) => f.projectedDelayDays >= 4 || f.stallLikelihood >= 45)
    .sort((a, b) => b.stallLikelihood - a.stallLikelihood)
    .slice(0, 20);
}

export function buildForecastAwareRecommendations(input: {
  riskAlerts: import("@/lib/fulfillment/executive-kpi-forecast-types").ForecastedRiskAlert[];
}): FulfillmentRecommendation[] {
  const recs: FulfillmentRecommendation[] = [];

  for (const alert of input.riskAlerts.slice(0, 8)) {
    const priority =
      alert.severity === "high" ? "high" : alert.severity === "medium" ? "normal" : "low";
    let kind: FulfillmentRecommendation["kind"] = "monitor_only";
    if (alert.category === "approval_bottleneck") kind = "approval_review";
    else if (alert.category === "revision_risk") kind = "stall_recovery";
    else if (alert.category === "department_overload" || alert.category === "workflow_stall")
      kind = "resolve_bottleneck";
    else if (alert.category === "fulfillment_delay") kind = "stall_recovery";

    recs.push({
      id: randomUUID(),
      kind,
      department: alert.department,
      priority,
      title: `[Forecast] ${alert.title}`,
      rationale: `${alert.rationale} Confidence: ${alert.confidence} (${Math.round(alert.confidenceScore * 100)}%). ${alert.memoryEvidence ?? "Snapshot evidence."} Advisory only.`,
      requiresHumanAction: true,
      relatedOrderIds: alert.relatedOrderIds,
    });
  }

  return recs;
}

export function buildExecutiveKpiForecastFromEngine(
  input: ExecutiveKpiEngineInput
): Omit<ExecutiveKpiForecastDto, "ok" | "generatedAt" | "meta"> {
  const overview = buildExecutiveKpiOverviewFromEngine(input);
  const bottlenecks = input.bottlenecks.length
    ? input.bottlenecks
    : detectOperationalBottlenecks(input.snapshots);
  const fulfillmentDelays = buildFulfillmentDelayForecasts(input.snapshots);
  const bottleneckForecasts = buildBottleneckForecasts({ bottlenecks, snapshots: input.snapshots });
  const revisionRisks = buildRevisionRiskForecasts({
    snapshots: input.snapshots,
    outcomes: input.outcomes,
    clientLifecycle: input.clientLifecycle,
  });
  const approvalDelays = buildApprovalDelayForecasts({
    snapshots: input.snapshots,
    approvalLatency: input.approvalLatency,
  });
  const departmentWorkload = buildDepartmentWorkloadBalance(input.snapshots);

  const riskAlerts = buildForecastedRiskAlerts({
    engine: input,
    fulfillmentDelays,
    bottleneckForecasts,
    revisionRisks,
    approvalDelays,
    departmentWorkload,
  });

  const forecastAwareRecommendations = buildForecastAwareRecommendations({ riskAlerts });
  const velocity = buildFulfillmentVelocitySnapshot(input.snapshots);
  const active = input.snapshots.filter(
    (o) => o.pipelineStage !== "released" && o.pipelineStage !== "closed"
  );
  const projectedStallsNext7d = Math.round(
    fulfillmentDelays.filter((f) => f.projectedDelayDays >= 7).length * 0.4 +
      bottleneckForecasts.filter((b) => b.daysToEscalation != null && b.daysToEscalation <= 7).length
  );

  const operationalHealth = computeDeskOperationalHealthScore({
    velocity,
    workload: departmentWorkload,
    stalledOrders: overview.totals.stalledOrders,
    pendingApprovals: overview.totals.pendingApprovals,
    criticalClients: overview.healthByTier.critical,
    atRiskClients: overview.healthByTier.at_risk,
  });

  const backlogConfidence: ForecastConfidence =
    projectedStallsNext7d >= 5 ? "high" : projectedStallsNext7d >= 2 ? "medium" : "low";

  const skipperSummary = [
    `Fulfillment forecast: desk health ${operationalHealth.score}/100; ${riskAlerts.length} risk alert(s).`,
    projectedStallsNext7d > 0
      ? `Projected ~${projectedStallsNext7d} additional stall(s) in 7d — advisory only.`
      : "Low projected stall growth next 7d.",
    revisionRisks.length > 0 ? `${revisionRisks.length} revision-risk client(s) flagged.` : null,
    approvalDelays.some((a) => a.pendingCount > 0)
      ? `${approvalDelays.reduce((s, a) => s + a.pendingCount, 0)} pending approval(s) with delay forecast.`
      : null,
    "No autonomous reassignment, approvals, or launch/publish/spend.",
  ]
    .filter(Boolean)
    .join(" ");

  return {
    operationalHealth,
    fulfillmentDelays,
    bottleneckForecasts,
    revisionRisks,
    approvalDelays,
    riskAlerts,
    forecastAwareRecommendations,
    projectedBacklog: {
      activeOrders: active.length,
      projectedStallsNext7d,
      confidence: backlogConfidence,
      evidence: `Based on ${fulfillmentDelays.length} delay forecast(s) and ${bottleneckForecasts.length} bottleneck projection(s).`,
    },
    skipperSummary,
  };
}
