import type { ExecutiveOperationalTaskDto } from "@/lib/executive-agent/executive-operational-tasks";
import { isTaskOverdue } from "@/lib/executive-agent/executive-operational-tasks";
import { analyzeBlockedOperationalTasks } from "@/lib/executive-agent/blocked-task-analysis";
import {
  buildTaskDependencyIndex,
  isDependencySatisfied,
} from "@/lib/executive-agent/task-dependency-graph";

export type ExecutiveTaskRecommendation = {
  taskId: string;
  title: string;
  rationale: string;
  priorityScore: number;
};

function priorityScore(task: ExecutiveOperationalTaskDto): number {
  let s = 0;
  if (task.priority === "urgent") s += 40;
  else if (task.priority === "high") s += 28;
  else if (task.priority === "normal") s += 12;
  if (isTaskOverdue(task)) s += 35;
  if (task.status === "blocked" || task.isBlocked) s += 25;
  if (task.dependencyBlocked) s -= 15;
  if (task.orderId) s += 10;
  if (task.decisionId) s += 8;
  if (task.status === "in_progress") s += 5;
  return s;
}

export function buildExecutiveTaskRecommendations(
  tasks: ExecutiveOperationalTaskDto[],
  max = 8
): ExecutiveTaskRecommendation[] {
  const index = buildTaskDependencyIndex(tasks);
  const blocked = analyzeBlockedOperationalTasks(tasks);

  const candidates = tasks.filter(
    (t) =>
      (t.status === "open" || t.status === "in_progress" || t.status === "blocked") &&
      t.status !== "completed" &&
      t.status !== "canceled"
  );

  const recs: ExecutiveTaskRecommendation[] = [];

  for (const t of candidates) {
    if (t.status === "blocked") {
      recs.push({
        taskId: t.id,
        title: t.title,
        rationale: `Unblock: ${t.blockedReason?.slice(0, 120) || "owner review required"}. Human coordination only.`,
        priorityScore: priorityScore(t) + 10,
      });
      continue;
    }
    if (t.dependencyBlocked || !isDependencySatisfied(t, index)) {
      const unmet = t.dependsOnTaskIds.filter((id) => index.get(id)?.status !== "completed");
      recs.push({
        taskId: t.id,
        title: t.title,
        rationale: `Complete prerequisite task(s) first (${unmet.length} blocking).`,
        priorityScore: priorityScore(t),
      });
      continue;
    }
    if (t.status === "open" && isTaskOverdue(t)) {
      recs.push({
        taskId: t.id,
        title: t.title,
        rationale: "Overdue — start or reassign with owner confirmation (no autonomous start).",
        priorityScore: priorityScore(t),
      });
      continue;
    }
    if (t.status === "open") {
      recs.push({
        taskId: t.id,
        title: t.title,
        rationale: t.recommendedAgent
          ? `Suggested agent hint: ${t.recommendedAgent} — owner must start task.`
          : "Ready for owner to start — no autonomous execution.",
        priorityScore: priorityScore(t),
      });
    }
    if (t.status === "in_progress") {
      recs.push({
        taskId: t.id,
        title: t.title,
        rationale: "In progress — owner may complete when fulfillment gates are satisfied.",
        priorityScore: priorityScore(t) - 5,
      });
    }
  }

  if (blocked.fulfillmentBottlenecks.length) {
    for (const b of blocked.fulfillmentBottlenecks.slice(0, 3)) {
      if (!recs.some((r) => r.taskId === b.taskId)) {
        recs.push({
          taskId: b.taskId,
          title: b.title,
          rationale: b.reason,
          priorityScore: 45,
        });
      }
    }
  }

  return recs.sort((a, b) => b.priorityScore - a.priorityScore).slice(0, max);
}
