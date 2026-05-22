import {
  FULFILLMENT_PRIMARY_SERVICE_REVENUE_OS,
  FULFILLMENT_PRIMARY_SERVICE_SMART_TRUST,
  FULFILLMENT_PRIMARY_SERVICE_TRUST,
  FULFILLMENT_PRIMARY_SERVICE_WEBSITE,
} from "@/lib/fulfillment/fulfillment-types";
import {
  buildDepartmentWorkloadBalance,
  detectOverloadedDepartments,
} from "@/lib/fulfillment/department-workload-balance";
import type {
  ExecutiveKpiEngineInput,
  ExecutiveKpiMetric,
  ExecutiveKpiOverviewDto,
  FulfillmentVelocitySnapshot,
} from "@/lib/fulfillment/executive-kpi-forecast-types";
import {
  computeDeskOperationalHealthScore,
  summarizeHealthByTier,
} from "@/lib/fulfillment/operational-health-score";

const STALL_DAYS = 7;

export function buildFulfillmentVelocitySnapshot(
  snapshots: ExecutiveKpiEngineInput["snapshots"]
): FulfillmentVelocitySnapshot {
  const active = snapshots.filter(
    (o) => o.pipelineStage !== "released" && o.pipelineStage !== "closed"
  );
  const stalledCount = active.filter((o) => o.daysInCurrentStage >= STALL_DAYS).length;
  const progressingCount = active.length - stalledCount;
  const avgDaysInStage =
    active.length > 0
      ? Math.round(
          (active.reduce((s, o) => s + o.daysInCurrentStage, 0) / active.length) * 10
        ) / 10
      : 0;
  const velocityScore =
    active.length === 0
      ? 100
      : Math.round((progressingCount / active.length) * 100 - stalledCount * 3);

  return {
    ordersAnalyzed: active.length,
    progressingCount,
    stalledCount,
    velocityScore: Math.max(0, Math.min(100, velocityScore)),
    avgDaysInStage,
    evidence: `${progressingCount}/${active.length} orders progressing; ${stalledCount} stalled ≥${STALL_DAYS}d`,
  };
}

export function buildExecutiveKpiMetrics(input: ExecutiveKpiEngineInput): ExecutiveKpiMetric[] {
  const active = input.snapshots.filter(
    (o) => o.pipelineStage !== "released" && o.pipelineStage !== "closed"
  );
  const pendingApprovals = active.filter((o) => o.approvalStatus === "pending").length;
  const revisionHeavy = input.clientLifecycle.filter((c) => c.revisionBurden === "high").length;
  const velocity = buildFulfillmentVelocitySnapshot(input.snapshots);
  const overloaded = detectOverloadedDepartments(buildDepartmentWorkloadBalance(input.snapshots));

  return [
    {
      key: "active_orders",
      label: "Active fulfillment orders",
      value: active.length,
      unit: "orders",
      trend: null,
      evidence: "Open orders across WEBSITE, TRUST, REVENUE_OS, SMART_TRUST",
    },
    {
      key: "velocity_score",
      label: "Fulfillment velocity score",
      value: velocity.velocityScore,
      unit: "score",
      trend: velocity.velocityScore >= 65 ? "up" : velocity.stalledCount > 2 ? "down" : "flat",
      evidence: velocity.evidence,
    },
    {
      key: "pending_approvals",
      label: "Pending approvals",
      value: pendingApprovals,
      unit: "approvals",
      trend: pendingApprovals > 3 ? "down" : null,
      evidence: "Owner-controlled approvals — no autonomous execution",
    },
    {
      key: "revision_heavy_clients",
      label: "Revision-heavy clients",
      value: revisionHeavy,
      unit: "clients",
      trend: revisionHeavy > 0 ? "down" : "flat",
      evidence: "From operational memory lifecycle insights",
    },
    {
      key: "overloaded_departments",
      label: "Elevated/overloaded departments",
      value: overloaded.length,
      unit: "departments",
      trend: overloaded.length > 1 ? "down" : null,
      evidence: overloaded.map((d) => d.department).join(", ") || "Balanced desk load",
    },
    {
      key: "bottleneck_clusters",
      label: "Active bottleneck clusters",
      value: input.bottlenecks.length,
      unit: "clusters",
      trend: null,
      evidence: "Stage/department clusters from orchestration graph",
    },
  ];
}

export function buildExecutiveKpiOverviewFromEngine(
  input: ExecutiveKpiEngineInput
): Omit<ExecutiveKpiOverviewDto, "ok" | "generatedAt" | "meta"> {
  const velocity = buildFulfillmentVelocitySnapshot(input.snapshots);
  const departmentWorkload = buildDepartmentWorkloadBalance(input.snapshots);
  const healthByTier = summarizeHealthByTier(input.healthByClient);
  const active = input.snapshots.filter(
    (o) => o.pipelineStage !== "released" && o.pipelineStage !== "closed"
  );
  const stalledOrders = active.filter((o) => o.daysInCurrentStage >= STALL_DAYS).length;
  const pendingApprovals = active.filter((o) => o.approvalStatus === "pending").length;

  const operationalHealth = computeDeskOperationalHealthScore({
    velocity,
    workload: departmentWorkload,
    stalledOrders,
    pendingApprovals,
    criticalClients: healthByTier.critical,
    atRiskClients: healthByTier.at_risk,
  });

  const metrics = buildExecutiveKpiMetrics(input);

  const skipperSummary = [
    `Executive KPI overview: desk health ${operationalHealth.score}/100 (${operationalHealth.tier}).`,
    `Velocity ${velocity.velocityScore}/100 — ${velocity.evidence}.`,
    pendingApprovals > 0 ? `${pendingApprovals} pending approval(s) — owner action required.` : null,
    departmentWorkload.find((d) => d.balanceLabel === "overloaded")
      ? `Overloaded: ${departmentWorkload.filter((d) => d.balanceLabel === "overloaded").map((d) => d.department).join(", ")}.`
      : null,
    "Forecasting advisory only — no autonomous corrective actions.",
  ]
    .filter(Boolean)
    .join(" ");

  return {
    metrics,
    velocity,
    departmentWorkload,
    operationalHealth,
    totals: {
      activeOrders: active.length,
      stalledOrders,
      pendingApprovals,
      revisionHeavyClients: input.clientLifecycle.filter((c) => c.revisionBurden === "high").length,
      websiteOrders: active.filter((o) => o.department === FULFILLMENT_PRIMARY_SERVICE_WEBSITE).length,
      trustOrders: active.filter((o) => o.department === FULFILLMENT_PRIMARY_SERVICE_TRUST).length,
      revenueOsOrders: active.filter((o) => o.department === FULFILLMENT_PRIMARY_SERVICE_REVENUE_OS).length,
      smartTrustOrders: active.filter((o) => o.department === FULFILLMENT_PRIMARY_SERVICE_SMART_TRUST).length,
    },
    healthByTier,
    skipperSummary,
  };
}
