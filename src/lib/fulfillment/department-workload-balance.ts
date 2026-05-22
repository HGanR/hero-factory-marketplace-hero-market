import type { ClientFulfillmentOrderSnapshot } from "@/lib/fulfillment/fulfillment-orchestration-types";
import { FULFILLMENT_ORCHESTRATION_DEPARTMENTS } from "@/lib/fulfillment/fulfillment-orchestration-types";
import type { DepartmentWorkloadSnapshot } from "@/lib/fulfillment/executive-kpi-forecast-types";

const STALL_DAYS = 7;

export function buildDepartmentWorkloadBalance(
  snapshots: ClientFulfillmentOrderSnapshot[]
): DepartmentWorkloadSnapshot[] {
  const active = snapshots.filter(
    (o) => o.pipelineStage !== "released" && o.pipelineStage !== "closed"
  );

  const rows = FULFILLMENT_ORCHESTRATION_DEPARTMENTS.map((department) => {
    const deptOrders = active.filter((o) => o.department === department);
    const stalledOrders = deptOrders.filter((o) => o.daysInCurrentStage >= STALL_DAYS).length;
    const pendingApprovals = deptOrders.filter((o) => o.approvalStatus === "pending").length;
    const avgDaysInStage =
      deptOrders.length > 0
        ? Math.round(
            (deptOrders.reduce((s, o) => s + o.daysInCurrentStage, 0) / deptOrders.length) * 10
          ) / 10
        : 0;
    const loadIndex = Math.min(
      100,
      deptOrders.length * 8 + stalledOrders * 12 + pendingApprovals * 10 + avgDaysInStage * 2
    );
    const balanceLabel: DepartmentWorkloadSnapshot["balanceLabel"] =
      loadIndex >= 72
        ? "overloaded"
        : loadIndex >= 48
          ? "elevated"
          : loadIndex >= 20
            ? "balanced"
            : "underloaded";

    return {
      department,
      activeOrders: deptOrders.length,
      stalledOrders,
      pendingApprovals,
      avgDaysInStage,
      loadIndex,
      balanceLabel,
    };
  });

  return rows.sort((a, b) => b.loadIndex - a.loadIndex);
}

export function detectOverloadedDepartments(
  workload: DepartmentWorkloadSnapshot[]
): DepartmentWorkloadSnapshot[] {
  return workload.filter((w) => w.balanceLabel === "overloaded" || w.balanceLabel === "elevated");
}
