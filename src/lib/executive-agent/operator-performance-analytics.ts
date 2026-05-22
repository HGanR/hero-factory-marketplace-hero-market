import type { ExecutiveOperationalTaskDto } from "@/lib/executive-agent/executive-operational-tasks";
import {
  resolveOperatorIdFromTask,
} from "@/lib/executive-agent/executive-operator-registry";
import type { ExecutiveOperatorId } from "@/lib/executive-agent/executive-operator-types";

export type OperatorPerformanceRecord = {
  operatorId: ExecutiveOperatorId;
  completedTasks: number;
  avgCompletionDays: number | null;
  stalledOpenTasks: number;
  approvalLatencyHint: string | null;
  specializationHits: string[];
};

function daysBetween(start: string | null, end: string | null): number | null {
  if (!start || !end) return null;
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (!Number.isFinite(ms) || ms < 0) return null;
  return Math.round((ms / (24 * 60 * 60 * 1000)) * 10) / 10;
}

export function buildOperatorPerformanceAnalytics(
  tasks: ExecutiveOperationalTaskDto[]
): OperatorPerformanceRecord[] {
  const byOp = new Map<
    ExecutiveOperatorId,
    { completed: ExecutiveOperationalTaskDto[]; stalled: number }
  >();

  for (const t of tasks) {
    const opId = resolveOperatorIdFromTask({
      ownerLabel: t.ownerLabel,
      recommendedAgent: t.recommendedAgent,
      department: t.department,
    });
    const hit = byOp.get(opId) ?? { completed: [], stalled: 0 };
    if (t.status === "completed") hit.completed.push(t);
    else if (
      (t.status === "open" || t.status === "in_progress" || t.status === "blocked") &&
      (t.isOverdue || t.isBlocked)
    ) {
      hit.stalled += 1;
    }
    byOp.set(opId, hit);
  }

  return [...byOp.entries()].map(([operatorId, v]) => {
    const durations = v.completed
      .map((t) => daysBetween(t.startedAt ?? t.createdAt, t.completedAt))
      .filter((d): d is number => d != null);
    const avg =
      durations.length > 0
        ? Math.round((durations.reduce((s, d) => s + d, 0) / durations.length) * 10) / 10
        : null;

    return {
      operatorId,
      completedTasks: v.completed.length,
      avgCompletionDays: avg,
      stalledOpenTasks: v.stalled,
      approvalLatencyHint:
        v.stalled > 0 ? `${v.stalled} task(s) stalled ≥7d — watch owner approval latency` : null,
      specializationHits: [],
    };
  });
}
