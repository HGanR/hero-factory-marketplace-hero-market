import { randomUUID } from "crypto";
import type { ExecutiveOperationalTaskDto } from "@/lib/executive-agent/executive-operational-tasks";
import {
  listOperatorsForDepartment,
  resolveOperatorIdFromTask,
} from "@/lib/executive-agent/executive-operator-registry";
import type {
  DelegationRecommendation,
  OperatorWorkloadSnapshot,
} from "@/lib/executive-agent/executive-operator-types";
import { parseTaskCoordinationMetadata } from "@/lib/executive-agent/operator-task-metadata";

export function buildDelegationRecommendations(input: {
  tasks: ExecutiveOperationalTaskDto[];
  workload: OperatorWorkloadSnapshot[];
  metadataByTaskId: Map<string, ReturnType<typeof parseTaskCoordinationMetadata>>;
}): DelegationRecommendation[] {
  const recs: DelegationRecommendation[] = [];
  const underloaded = input.workload.filter((w) => w.balanceLabel === "underloaded" || w.balanceLabel === "balanced");
  const overloaded = input.workload.filter((w) => w.balanceLabel === "overloaded" || w.balanceLabel === "elevated");

  for (const t of input.tasks) {
    if (t.status === "completed" || t.status === "canceled") continue;
    const meta = input.metadataByTaskId.get(t.id);
    if (meta?.delegation?.status === "proposed" || meta?.delegation?.status === "approved") continue;

    const fromId = resolveOperatorIdFromTask({
      ownerLabel: t.ownerLabel,
      recommendedAgent: t.recommendedAgent,
      department: t.department,
    });
    const fromLoad = input.workload.find((w) => w.operatorId === fromId);
    if (!fromLoad || fromLoad.balanceLabel !== "overloaded") continue;

    const candidates = listOperatorsForDepartment(t.department).filter(
      (o) => o.id !== fromId && underloaded.some((u) => u.operatorId === o.id)
    );
    const target = candidates[0];
    if (!target) continue;

    recs.push({
      id: randomUUID(),
      taskId: t.id,
      fromOperatorId: fromId,
      toOperatorId: target.id,
      title: `Delegate "${t.title.slice(0, 40)}" to ${target.label}`,
      rationale: `${fromLoad.label} overloaded (load ${fromLoad.loadIndex}); ${target.label} has capacity. Owner approval required — no autonomous delegation.`,
      confidence: fromLoad.overdueTasks > 0 ? "high" : "medium",
      advisoryOnly: true,
    });
  }

  if (overloaded.length >= 2 && underloaded.length > 0) {
    const target = underloaded[0]!;
    recs.push({
      id: randomUUID(),
      taskId: "",
      fromOperatorId: overloaded[0]!.operatorId,
      toOperatorId: target.operatorId,
      title: "Desk-wide delegation rebalance opportunity",
      rationale: `Multiple overloaded operators (${overloaded.map((o) => o.label).join(", ")}) — consider owner-approved task redistribution to ${target.label}.`,
      confidence: "medium",
      advisoryOnly: true,
    });
  }

  return recs.slice(0, 15);
}
