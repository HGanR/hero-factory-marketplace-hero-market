import type { ExecutiveOperationalTaskDto } from "@/lib/executive-agent/executive-operational-tasks";
import type { OperatorWorkloadSnapshot } from "@/lib/executive-agent/executive-operator-types";
import { parseTaskCoordinationMetadata } from "@/lib/executive-agent/operator-task-metadata";
import type { FulfillmentOrchestrationDepartment } from "@/lib/fulfillment/fulfillment-orchestration-types";

export type WorkforceBottleneck = {
  id: string;
  kind: "operator_overload" | "delegation_stall" | "department_imbalance" | "escalation_backlog";
  department: FulfillmentOrchestrationDepartment | null;
  title: string;
  summary: string;
  taskCount: number;
  severity: "low" | "medium" | "high";
};

export function detectWorkforceBottlenecks(input: {
  tasks: ExecutiveOperationalTaskDto[];
  workload: OperatorWorkloadSnapshot[];
  metadataByTaskId: Map<string, ReturnType<typeof parseTaskCoordinationMetadata>>;
}): WorkforceBottleneck[] {
  const bottlenecks: WorkforceBottleneck[] = [];

  for (const w of input.workload.filter((o) => o.balanceLabel === "overloaded")) {
    bottlenecks.push({
      id: `overload_${w.operatorId}`,
      kind: "operator_overload",
      department: w.department,
      title: `${w.label} overloaded`,
      summary: `Load index ${w.loadIndex}: ${w.openTasks} open, ${w.blockedTasks} blocked, ${w.overdueTasks} overdue.`,
      taskCount: w.openTasks + w.inProgressTasks + w.blockedTasks,
      severity: w.overdueTasks > 0 ? "high" : "medium",
    });
  }

  let delegationStall = 0;
  for (const t of input.tasks) {
    const meta = input.metadataByTaskId.get(t.id);
    if (
      meta?.delegation?.status === "approved" &&
      !meta.delegation.acceptedAt &&
      t.status !== "completed"
    ) {
      delegationStall += 1;
    }
  }
  if (delegationStall > 0) {
    bottlenecks.push({
      id: "delegation_stall",
      kind: "delegation_stall",
      department: null,
      title: "Stalled delegated tasks (pending acceptance)",
      summary: `${delegationStall} delegated task(s) await owner/operator acceptance — no autonomous acceptance.`,
      taskCount: delegationStall,
      severity: delegationStall >= 3 ? "high" : "medium",
    });
  }

  const deptLoad = new Map<FulfillmentOrchestrationDepartment | "none", number>();
  for (const w of input.workload) {
    if (!w.department) continue;
    deptLoad.set(w.department, (deptLoad.get(w.department) ?? 0) + w.loadIndex);
  }
  const entries = [...deptLoad.entries()].sort((a, b) => b[1] - a[1]);
  if (entries.length >= 2 && entries[0]![1] > entries[1]![1] * 1.6) {
    bottlenecks.push({
      id: `dept_imbalance_${entries[0]![0]}`,
      kind: "department_imbalance",
      department: entries[0]![0] as FulfillmentOrchestrationDepartment,
      title: `Department staffing imbalance — ${entries[0]![0]}`,
      summary: `${entries[0]![0]} load index ${entries[0]![1]} vs next desk ${entries[1]![1]}.`,
      taskCount: 0,
      severity: "medium",
    });
  }

  const escalationPending = input.tasks.filter((t) => {
    const m = input.metadataByTaskId.get(t.id);
    return m?.escalation?.status === "proposed";
  }).length;
  if (escalationPending > 0) {
    bottlenecks.push({
      id: "escalation_backlog",
      kind: "escalation_backlog",
      department: null,
      title: "Escalation proposals awaiting owner approval",
      summary: `${escalationPending} escalation proposal(s) pending — no autonomous escalation execution.`,
      taskCount: escalationPending,
      severity: "medium",
    });
  }

  return bottlenecks;
}
