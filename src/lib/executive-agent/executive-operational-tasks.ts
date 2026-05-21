import type {
  EXECUTIVE_OPERATIONAL_TASK_STATUSES,
  EXECUTIVE_OPERATIONAL_THREAD_PRIORITIES,
} from "@/lib/db/schema.platform-extras";
import type { ExecutiveSubjectId } from "@/lib/executive-agent/executive-subject-nav";
import type { FulfillmentOrchestrationDepartment } from "@/lib/fulfillment/fulfillment-orchestration-types";

export type ExecutiveOperationalTaskStatus = (typeof EXECUTIVE_OPERATIONAL_TASK_STATUSES)[number];
export type ExecutiveOperationalTaskPriority = (typeof EXECUTIVE_OPERATIONAL_THREAD_PRIORITIES)[number];

export type ExecutiveOperationalTaskDto = {
  id: string;
  title: string;
  description: string;
  status: ExecutiveOperationalTaskStatus;
  priority: ExecutiveOperationalTaskPriority;
  ownerLabel: string;
  department: FulfillmentOrchestrationDepartment | null;
  recommendedAgent: string | null;
  decisionId: string | null;
  threadId: string | null;
  approvalId: string | null;
  orderId: string | null;
  clientId: string | null;
  subjectId: ExecutiveSubjectId | null;
  blockedReason: string | null;
  blockedAt: string | null;
  dueAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  dependsOnTaskIds: string[];
  createdAt: string;
  updatedAt: string;
  isOverdue: boolean;
  isBlocked: boolean;
  dependencyBlocked: boolean;
};

export type ExecutiveOperationalTasksQueueDto = {
  ok: true;
  open: ExecutiveOperationalTaskDto[];
  inProgress: ExecutiveOperationalTaskDto[];
  blocked: ExecutiveOperationalTaskDto[];
  overdue: ExecutiveOperationalTaskDto[];
  recommendations: Array<{ taskId: string; title: string; rationale: string }>;
  skipperTaskContext: string;
  generatedAt: string;
};

export type CreateExecutiveOperationalTaskInput = {
  title: string;
  description: string;
  priority?: ExecutiveOperationalTaskPriority;
  ownerLabel?: string;
  department?: FulfillmentOrchestrationDepartment | null;
  recommendedAgent?: string | null;
  decisionId?: string | null;
  threadId?: string | null;
  approvalId?: string | null;
  orderId?: string | null;
  clientId?: string | null;
  subjectId?: ExecutiveSubjectId | null;
  dueAt?: string | null;
  dependsOnTaskIds?: string[];
};

const STATUS_SET = new Set<string>(["open", "in_progress", "blocked", "completed", "canceled"]);
const PRIORITY_SET = new Set<string>(["low", "normal", "high", "urgent"]);

export function isExecutiveOperationalTaskStatus(v: string): v is ExecutiveOperationalTaskStatus {
  return STATUS_SET.has(v);
}

export function isExecutiveOperationalTaskPriority(v: string): v is ExecutiveOperationalTaskPriority {
  return PRIORITY_SET.has(v);
}

export function parseDependsOnTaskIdsJson(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is string => typeof x === "string" && x.trim().length > 0);
  } catch {
    return [];
  }
}

export function serializeDependsOnTaskIds(ids: string[]): string | null {
  const list = ids.map((id) => id.trim()).filter(Boolean);
  return list.length ? JSON.stringify(list) : null;
}

export function isTaskOverdue(task: Pick<ExecutiveOperationalTaskDto, "status" | "dueAt">): boolean {
  if (!task.dueAt) return false;
  if (task.status === "completed" || task.status === "canceled") return false;
  return new Date(task.dueAt).getTime() < Date.now();
}

export function buildSkipperOperationalTasksContext(input: {
  open: ExecutiveOperationalTaskDto[];
  blocked: ExecutiveOperationalTaskDto[];
  overdue: ExecutiveOperationalTaskDto[];
  recommendations: Array<{ title: string; rationale: string }>;
}): string {
  const lines = [
    "Executive operational tasks — human-coordinated only; no autonomous execution or assignment acceptance.",
  ];
  if (input.overdue.length) {
    lines.push(
      `Overdue (${input.overdue.length}): ${input.overdue.slice(0, 5).map((t) => `${t.title} [${t.priority}]`).join("; ")}`
    );
  }
  if (input.blocked.length) {
    lines.push(
      `Blocked (${input.blocked.length}): ${input.blocked.slice(0, 5).map((t) => `${t.title}${t.blockedReason ? ` — ${t.blockedReason.slice(0, 80)}` : ""}`).join("; ")}`
    );
  }
  const pending = input.open.filter((t) => !t.dependencyBlocked);
  if (pending.length) {
    lines.push(`Pending owner tasks: ${pending.slice(0, 6).map((t) => t.title).join("; ")}`);
  }
  if (input.recommendations.length) {
    lines.push(
      `Recommended next: ${input.recommendations.slice(0, 3).map((r) => `${r.title} — ${r.rationale}`).join(" | ")}`
    );
  }
  if (!input.overdue.length && !input.blocked.length && !pending.length) {
    lines.push("No active operational tasks in queue.");
  }
  return lines.join(" ");
}
