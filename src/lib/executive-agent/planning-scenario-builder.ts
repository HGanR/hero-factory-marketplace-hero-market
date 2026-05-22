import type {
  ExecutivePlanningEngineInput,
  PlanningEvidenceLink,
  PlanningPlanId,
} from "@/lib/executive-agent/executive-planning-types";

export type PlanningScenarioContext = {
  planId: PlanningPlanId;
  horizonDays: number;
  stalledOrders: number;
  pendingApprovals: number;
  blockedTasks: number;
  overloadedOperators: string[];
  smartTrustPending: number;
  revenueOsActive: number;
  focusDepartments: string[];
  evidence: PlanningEvidenceLink[];
};

export function buildPlanningScenarioContext(
  input: ExecutivePlanningEngineInput,
  planId: PlanningPlanId,
  horizonDays: number
): PlanningScenarioContext {
  const snapshots = input.kpi.snapshots;
  const active = snapshots.filter(
    (s) => s.pipelineStage !== "released" && s.pipelineStage !== "closed"
  );
  const stalled = active.filter((s) => s.daysInCurrentStage >= 10);
  const pendingApprovals = active.filter((s) => s.approvalStatus === "pending").length;
  const blockedTasks = input.tasks.filter((t) => t.status === "blocked" || t.isBlocked).length;
  const overloadedOperators = input.operatorWorkload
    .filter((w) => w.balanceLabel === "overloaded" || w.balanceLabel === "elevated")
    .map((w) => w.operatorId);

  const focusDepartments = [...new Set(active.map((s) => s.department))];

  return {
    planId,
    horizonDays,
    stalledOrders: stalled.length,
    pendingApprovals,
    blockedTasks,
    overloadedOperators,
    smartTrustPending: active.filter((s) => s.department === "SMART_TRUST").length,
    revenueOsActive: active.filter((s) => s.department === "REVENUE_OS").length,
    focusDepartments,
    evidence: [
      { source: "snapshots", detail: `${active.length} active fulfillment order(s)` },
      { source: "tasks", detail: `${blockedTasks} blocked task(s)` },
      { source: "operators", detail: `${overloadedOperators.length} elevated/overloaded operator(s)` },
    ],
  };
}
