import type { ExecutiveOperationalTaskDto } from "@/lib/executive-agent/executive-operational-tasks";
import {
  buildTaskDependencyIndex,
  isDependencySatisfied,
  tasksBlockedByDependencies,
} from "@/lib/executive-agent/task-dependency-graph";

export type BlockedTaskInsight = {
  taskId: string;
  title: string;
  kind: "explicit_blocked" | "dependency_blocked" | "fulfillment_bottleneck";
  reason: string;
  department: string | null;
  orderId: string | null;
};

export function analyzeBlockedOperationalTasks(tasks: ExecutiveOperationalTaskDto[]): {
  explicitBlocked: BlockedTaskInsight[];
  dependencyBlocked: BlockedTaskInsight[];
  fulfillmentBottlenecks: BlockedTaskInsight[];
  all: BlockedTaskInsight[];
} {
  const index = buildTaskDependencyIndex(tasks);
  const depBlockedIds = tasksBlockedByDependencies(tasks, index);

  const explicitBlocked: BlockedTaskInsight[] = tasks
    .filter((t) => t.status === "blocked")
    .map((t) => ({
      taskId: t.id,
      title: t.title,
      kind: "explicit_blocked" as const,
      reason: t.blockedReason?.trim() || "Task marked blocked by owner.",
      department: t.department,
      orderId: t.orderId,
    }));

  const dependencyBlocked: BlockedTaskInsight[] = tasks
    .filter((t) => depBlockedIds.has(t.id) && t.status !== "blocked")
    .map((t) => {
      const unmet = t.dependsOnTaskIds.filter((id) => index.get(id)?.status !== "completed");
      return {
        taskId: t.id,
        title: t.title,
        kind: "dependency_blocked" as const,
        reason: `Waiting on ${unmet.length} prerequisite task(s).`,
        department: t.department,
        orderId: t.orderId,
      };
    });

  const fulfillmentBottlenecks: BlockedTaskInsight[] = tasks
    .filter(
      (t) =>
        t.orderId &&
        (t.status === "blocked" || depBlockedIds.has(t.id)) &&
        (t.department === "WEBSITE" || t.department === "TRUST")
    )
    .map((t) => ({
      taskId: t.id,
      title: t.title,
      kind: "fulfillment_bottleneck" as const,
      reason: `${t.department} fulfillment blocked by operational task.`,
      department: t.department,
      orderId: t.orderId,
    }));

  return {
    explicitBlocked,
    dependencyBlocked,
    fulfillmentBottlenecks,
    all: [...explicitBlocked, ...dependencyBlocked, ...fulfillmentBottlenecks],
  };
}

export function canStartTask(
  task: ExecutiveOperationalTaskDto,
  index: Map<string, Pick<ExecutiveOperationalTaskDto, "id" | "status" | "dependsOnTaskIds">>
): { ok: boolean; reason?: string } {
  if (task.status !== "open") return { ok: false, reason: "task_not_open" };
  if (!isDependencySatisfied(task, index)) {
    return { ok: false, reason: "dependencies_incomplete" };
  }
  return { ok: true };
}
