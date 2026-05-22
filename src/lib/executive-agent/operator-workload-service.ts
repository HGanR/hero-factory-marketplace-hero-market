import type { ExecutiveOperationalTaskDto } from "@/lib/executive-agent/executive-operational-tasks";
import {
  EXECUTIVE_OPERATOR_REGISTRY,
  resolveOperatorIdFromTask,
} from "@/lib/executive-agent/executive-operator-registry";
import type { OperatorWorkloadSnapshot } from "@/lib/executive-agent/executive-operator-types";
import { parseTaskCoordinationMetadata } from "@/lib/executive-agent/operator-task-metadata";

function balanceLabel(loadIndex: number): OperatorWorkloadSnapshot["balanceLabel"] {
  if (loadIndex >= 72) return "overloaded";
  if (loadIndex >= 48) return "elevated";
  if (loadIndex >= 18) return "balanced";
  return "underloaded";
}

export function buildOperatorWorkloadAnalytics(input: {
  tasks: ExecutiveOperationalTaskDto[];
  metadataByTaskId: Map<string, ReturnType<typeof parseTaskCoordinationMetadata>>;
}): OperatorWorkloadSnapshot[] {
  const byOperator = new Map<
    string,
    {
      open: number;
      inProgress: number;
      blocked: number;
      overdue: number;
      delegatedPending: number;
    }
  >();

  for (const op of EXECUTIVE_OPERATOR_REGISTRY) {
    byOperator.set(op.id, { open: 0, inProgress: 0, blocked: 0, overdue: 0, delegatedPending: 0 });
  }

  for (const t of input.tasks) {
    if (t.status === "completed" || t.status === "canceled") continue;
    const meta = input.metadataByTaskId.get(t.id) ?? {};
    const assignee =
      meta.delegation?.status === "approved"
        ? meta.delegation.targetOperatorId
        : resolveOperatorIdFromTask({
            ownerLabel: t.ownerLabel,
            recommendedAgent: t.recommendedAgent,
            department: t.department,
          });
    const bucket = byOperator.get(assignee) ?? byOperator.get("fulfillment_coordinator")!;
    if (t.status === "open") bucket.open += 1;
    if (t.status === "in_progress") bucket.inProgress += 1;
    if (t.isBlocked) bucket.blocked += 1;
    if (t.isOverdue) bucket.overdue += 1;
    if (
      meta.delegation?.status === "approved" &&
      !meta.delegation.acceptedAt &&
      meta.delegation.acceptanceRequired
    ) {
      bucket.delegatedPending += 1;
    }
  }

  return EXECUTIVE_OPERATOR_REGISTRY.map((op) => {
    const counts = byOperator.get(op.id)!;
    const active = counts.open + counts.inProgress + counts.blocked;
    const loadIndex = Math.min(
      100,
      active * 10 + counts.blocked * 8 + counts.overdue * 12 + counts.delegatedPending * 6
    );
    return {
      operatorId: op.id,
      label: op.label,
      department: op.department,
      openTasks: counts.open,
      inProgressTasks: counts.inProgress,
      blockedTasks: counts.blocked,
      overdueTasks: counts.overdue,
      delegatedPendingAcceptance: counts.delegatedPending,
      loadIndex,
      balanceLabel: balanceLabel(loadIndex),
    };
  }).sort((a, b) => b.loadIndex - a.loadIndex);
}

export function detectOverloadedOperators(
  workload: OperatorWorkloadSnapshot[]
): OperatorWorkloadSnapshot[] {
  return workload.filter((w) => w.balanceLabel === "overloaded" || w.balanceLabel === "elevated");
}
