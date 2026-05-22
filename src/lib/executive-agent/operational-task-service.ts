import "server-only";

import { randomUUID } from "crypto";
import type { MySql2Database } from "drizzle-orm/mysql2";
import { and, desc, eq, inArray } from "drizzle-orm";
import * as schema from "@/lib/db/schema";
import { executiveOperationalTasks } from "@/lib/db/schema";
import { insertExecutiveAgentAuditLog } from "@/lib/executive-agent/executive-agent-audit";
import { analyzeBlockedOperationalTasks } from "@/lib/executive-agent/blocked-task-analysis";
import { buildExecutiveTaskRecommendations } from "@/lib/executive-agent/executive-task-recommendations";
import {
  buildSkipperOperationalTasksContext,
  isTaskOverdue,
  parseDependsOnTaskIdsJson,
  serializeDependsOnTaskIds,
  type CreateExecutiveOperationalTaskInput,
  type ExecutiveOperationalTaskDto,
  type ExecutiveOperationalTasksQueueDto,
} from "@/lib/executive-agent/executive-operational-tasks";
import { normalizeDepartment } from "@/lib/executive-agent/executive-conversation-threads";
import { isExecutiveSubjectId, type ExecutiveSubjectId } from "@/lib/executive-agent/executive-subject-nav";
import {
  detectCircularDependencies,
  tasksBlockedByDependencies,
} from "@/lib/executive-agent/task-dependency-graph";
import { canStartTask } from "@/lib/executive-agent/blocked-task-analysis";
import { buildTaskDependencyIndex } from "@/lib/executive-agent/task-dependency-graph";
import { parseTaskCoordinationMetadata } from "@/lib/executive-agent/operator-task-metadata";

type Db = MySql2Database<typeof schema>;

export function rowToTaskDto(row: typeof executiveOperationalTasks.$inferSelect): ExecutiveOperationalTaskDto {
  const subjectId = row.subjectId?.trim() ?? null;
  const dependsOnTaskIds = parseDependsOnTaskIdsJson(row.dependsOnTaskIdsJson);
  const dto: ExecutiveOperationalTaskDto = {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status,
    priority: row.priority,
    ownerLabel: row.ownerLabel,
    department: normalizeDepartment(row.department),
    recommendedAgent: row.recommendedAgent?.trim() ?? null,
    decisionId: row.decisionId?.trim() ?? null,
    threadId: row.threadId?.trim() ?? null,
    approvalId: row.approvalId?.trim() ?? null,
    orderId: row.orderId?.trim() ?? null,
    clientId: row.clientId?.trim() ?? null,
    subjectId: subjectId && isExecutiveSubjectId(subjectId) ? subjectId : null,
    blockedReason: row.blockedReason?.trim() ?? null,
    blockedAt: row.blockedAt ? row.blockedAt.toISOString() : null,
    dueAt: row.dueAt ? row.dueAt.toISOString() : null,
    startedAt: row.startedAt ? row.startedAt.toISOString() : null,
    completedAt: row.completedAt ? row.completedAt.toISOString() : null,
    dependsOnTaskIds,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    isOverdue: false,
    isBlocked: row.status === "blocked",
    dependencyBlocked: false,
  };
  dto.isOverdue = isTaskOverdue(dto);
  dto.coordination = parseTaskCoordinationMetadata(row.metadataJson);
  return dto;
}

function enrichTasks(tasks: ExecutiveOperationalTaskDto[]): ExecutiveOperationalTaskDto[] {
  const depBlocked = tasksBlockedByDependencies(tasks);
  return tasks.map((t) => ({
    ...t,
    dependencyBlocked: depBlocked.has(t.id),
    isBlocked: t.status === "blocked" || depBlocked.has(t.id),
  }));
}

async function auditTaskAction(
  db: Db,
  row: {
    adminUserId: number;
    actionType: string;
    targetId: string;
    inputJson?: Record<string, unknown>;
    outputJson?: Record<string, unknown>;
  }
): Promise<void> {
  await insertExecutiveAgentAuditLog(db, {
    id: randomUUID(),
    adminUserId: row.adminUserId,
    prompt: null,
    toolName: "executive_operational_tasks",
    actionType: row.actionType,
    targetType: "executive_operational_task",
    targetId: row.targetId,
    inputJson: row.inputJson ? JSON.stringify(row.inputJson).slice(0, 50_000) : null,
    outputJson: row.outputJson ? JSON.stringify(row.outputJson).slice(0, 50_000) : null,
    approvalStatus: "not_required",
  });
}

export async function listExecutiveOperationalTasks(
  db: Db,
  input: {
    adminUserId: number;
    subjectId?: string | null;
    threadId?: string | null;
    decisionId?: string | null;
    orderId?: string | null;
    status?: string | null;
    limit?: number;
  }
): Promise<ExecutiveOperationalTasksQueueDto> {
  const limit = Math.min(Math.max(input.limit ?? 80, 1), 150);
  const conditions = [eq(executiveOperationalTasks.adminUserId, input.adminUserId)];

  if (input.subjectId?.trim()) {
    conditions.push(eq(executiveOperationalTasks.subjectId, input.subjectId.trim()));
  }
  if (input.threadId?.trim()) {
    conditions.push(eq(executiveOperationalTasks.threadId, input.threadId.trim()));
  }
  if (input.decisionId?.trim()) {
    conditions.push(eq(executiveOperationalTasks.decisionId, input.decisionId.trim()));
  }
  if (input.orderId?.trim()) {
    conditions.push(eq(executiveOperationalTasks.orderId, input.orderId.trim()));
  }

  const rows = await db
    .select()
    .from(executiveOperationalTasks)
    .where(and(...conditions))
    .orderBy(desc(executiveOperationalTasks.priority), desc(executiveOperationalTasks.updatedAt))
    .limit(limit);

  let tasks = enrichTasks(rows.map(rowToTaskDto));
  if (input.status) {
    tasks = tasks.filter((t) => t.status === input.status);
  }

  const open = tasks.filter((t) => t.status === "open");
  const inProgress = tasks.filter((t) => t.status === "in_progress");
  const blocked = tasks.filter((t) => t.status === "blocked" || t.dependencyBlocked);
  const overdue = tasks.filter((t) => t.isOverdue);
  const recommendations = buildExecutiveTaskRecommendations(tasks);

  await auditTaskAction(db, {
    adminUserId: input.adminUserId,
    actionType: "list_tasks",
    targetId: input.subjectId ?? input.threadId ?? "all",
    outputJson: { count: tasks.length, blocked: blocked.length, overdue: overdue.length },
  });

  return {
    ok: true,
    open,
    inProgress,
    blocked,
    overdue,
    recommendations,
    skipperTaskContext: buildSkipperOperationalTasksContext({
      open,
      blocked,
      overdue,
      recommendations,
    }),
    generatedAt: new Date().toISOString(),
  };
}

async function loadOwnedTask(
  db: Db,
  input: { adminUserId: number; taskId: string }
): Promise<typeof executiveOperationalTasks.$inferSelect | null> {
  const [row] = await db
    .select()
    .from(executiveOperationalTasks)
    .where(
      and(
        eq(executiveOperationalTasks.id, input.taskId),
        eq(executiveOperationalTasks.adminUserId, input.adminUserId)
      )
    )
    .limit(1);
  return row ?? null;
}

export async function createExecutiveOperationalTask(
  db: Db,
  input: { adminUserId: number } & CreateExecutiveOperationalTaskInput
): Promise<{ ok: true; task: ExecutiveOperationalTaskDto } | { ok: false; error: string }> {
  const dependsOn = input.dependsOnTaskIds ?? [];
  if (dependsOn.length) {
    const deps = await db
      .select()
      .from(executiveOperationalTasks)
      .where(
        and(
          eq(executiveOperationalTasks.adminUserId, input.adminUserId),
          inArray(executiveOperationalTasks.id, dependsOn)
        )
      );
    if (deps.length !== dependsOn.length) {
      return { ok: false, error: "invalid_dependency" };
    }
  }

  const id = randomUUID();
  const now = new Date();
  const subjectId =
    input.subjectId?.trim() && isExecutiveSubjectId(input.subjectId.trim())
      ? (input.subjectId.trim() as ExecutiveSubjectId)
      : null;

  await db.insert(executiveOperationalTasks).values({
    id,
    adminUserId: input.adminUserId,
    title: input.title.trim().slice(0, 500),
    description: input.description.trim().slice(0, 20_000),
    status: "open",
    priority: input.priority ?? "normal",
    ownerLabel: input.ownerLabel?.trim().slice(0, 64) || "executive_owner",
    department: input.department ?? null,
    recommendedAgent: input.recommendedAgent?.trim().slice(0, 64) ?? null,
    decisionId: input.decisionId?.trim() ?? null,
    threadId: input.threadId?.trim() ?? null,
    approvalId: input.approvalId?.trim() ?? null,
    orderId: input.orderId?.trim() ?? null,
    clientId: input.clientId?.trim() ?? null,
    subjectId,
    dueAt: input.dueAt ? new Date(input.dueAt) : null,
    dependsOnTaskIdsJson: serializeDependsOnTaskIds(dependsOn),
    createdAt: now,
    updatedAt: now,
  });

  const [row] = await db
    .select()
    .from(executiveOperationalTasks)
    .where(eq(executiveOperationalTasks.id, id))
    .limit(1);

  const allRows = await db
    .select()
    .from(executiveOperationalTasks)
    .where(eq(executiveOperationalTasks.adminUserId, input.adminUserId))
    .limit(150);
  const tasks = enrichTasks(allRows.map(rowToTaskDto));
  const cycle = detectCircularDependencies(tasks);
  if (cycle) {
    await db.delete(executiveOperationalTasks).where(eq(executiveOperationalTasks.id, id));
    return { ok: false, error: "circular_dependency" };
  }

  await auditTaskAction(db, {
    adminUserId: input.adminUserId,
    actionType: "create_task",
    targetId: id,
    inputJson: { threadId: input.threadId, orderId: input.orderId },
  });

  const [task] = enrichTasks([rowToTaskDto(row!)]);
  return { ok: true, task: task! };
}

export async function startExecutiveOperationalTask(
  db: Db,
  input: { adminUserId: number; taskId: string }
): Promise<{ ok: true; task: ExecutiveOperationalTaskDto } | { ok: false; error: string }> {
  const row = await loadOwnedTask(db, input);
  if (!row) return { ok: false, error: "task_not_found" };

  const allRows = await db
    .select()
    .from(executiveOperationalTasks)
    .where(eq(executiveOperationalTasks.adminUserId, input.adminUserId))
    .limit(150);
  const tasks = enrichTasks(allRows.map(rowToTaskDto));
  const task = tasks.find((t) => t.id === input.taskId)!;
  const index = buildTaskDependencyIndex(tasks);
  const gate = canStartTask(task, index);
  if (!gate.ok) return { ok: false, error: gate.reason ?? "cannot_start" };

  const now = new Date();
  await db
    .update(executiveOperationalTasks)
    .set({
      status: "in_progress",
      startedAt: row.startedAt ?? now,
      blockedReason: null,
      blockedAt: null,
      updatedAt: now,
    })
    .where(eq(executiveOperationalTasks.id, input.taskId));

  await auditTaskAction(db, {
    adminUserId: input.adminUserId,
    actionType: "start_task",
    targetId: input.taskId,
  });

  const [updated] = await db
    .select()
    .from(executiveOperationalTasks)
    .where(eq(executiveOperationalTasks.id, input.taskId))
    .limit(1);
  const [out] = enrichTasks([rowToTaskDto(updated!)]);
  return { ok: true, task: out! };
}

export async function completeExecutiveOperationalTask(
  db: Db,
  input: { adminUserId: number; taskId: string; completionNote?: string | null }
): Promise<{ ok: true; task: ExecutiveOperationalTaskDto } | { ok: false; error: string }> {
  const row = await loadOwnedTask(db, input);
  if (!row) return { ok: false, error: "task_not_found" };
  if (row.status !== "in_progress" && row.status !== "open") {
    return { ok: false, error: "task_not_completable" };
  }

  const now = new Date();
  await db
    .update(executiveOperationalTasks)
    .set({
      status: "completed",
      completedAt: now,
      blockedReason: null,
      blockedAt: null,
      updatedAt: now,
    })
    .where(eq(executiveOperationalTasks.id, input.taskId));

  await auditTaskAction(db, {
    adminUserId: input.adminUserId,
    actionType: "complete_task",
    targetId: input.taskId,
    inputJson: { note: input.completionNote?.slice(0, 500) },
  });

  const [updated] = await db
    .select()
    .from(executiveOperationalTasks)
    .where(eq(executiveOperationalTasks.id, input.taskId))
    .limit(1);
  const [out] = enrichTasks([rowToTaskDto(updated!)]);
  return { ok: true, task: out! };
}

export async function blockExecutiveOperationalTask(
  db: Db,
  input: { adminUserId: number; taskId: string; blockedReason: string }
): Promise<{ ok: true; task: ExecutiveOperationalTaskDto } | { ok: false; error: string }> {
  const row = await loadOwnedTask(db, input);
  if (!row) return { ok: false, error: "task_not_found" };
  if (row.status === "completed" || row.status === "canceled") {
    return { ok: false, error: "task_not_blockable" };
  }

  const reason = input.blockedReason.trim();
  if (!reason) return { ok: false, error: "empty_blocked_reason" };

  const now = new Date();
  await db
    .update(executiveOperationalTasks)
    .set({
      status: "blocked",
      blockedReason: reason.slice(0, 4000),
      blockedAt: now,
      updatedAt: now,
    })
    .where(eq(executiveOperationalTasks.id, input.taskId));

  await auditTaskAction(db, {
    adminUserId: input.adminUserId,
    actionType: "block_task",
    targetId: input.taskId,
    inputJson: { blockedReason: reason.slice(0, 200) },
  });

  const [updated] = await db
    .select()
    .from(executiveOperationalTasks)
    .where(eq(executiveOperationalTasks.id, input.taskId))
    .limit(1);
  const [out] = enrichTasks([rowToTaskDto(updated!)]);
  return { ok: true, task: out! };
}

export async function cancelExecutiveOperationalTask(
  db: Db,
  input: { adminUserId: number; taskId: string; cancelReason?: string | null }
): Promise<{ ok: true; task: ExecutiveOperationalTaskDto } | { ok: false; error: string }> {
  const row = await loadOwnedTask(db, input);
  if (!row) return { ok: false, error: "task_not_found" };
  if (row.status === "completed") return { ok: false, error: "task_already_completed" };

  const now = new Date();
  await db
    .update(executiveOperationalTasks)
    .set({
      status: "canceled",
      updatedAt: now,
    })
    .where(eq(executiveOperationalTasks.id, input.taskId));

  await auditTaskAction(db, {
    adminUserId: input.adminUserId,
    actionType: "cancel_task",
    targetId: input.taskId,
    inputJson: { reason: input.cancelReason?.slice(0, 200) },
  });

  const [updated] = await db
    .select()
    .from(executiveOperationalTasks)
    .where(eq(executiveOperationalTasks.id, input.taskId))
    .limit(1);
  const [out] = enrichTasks([rowToTaskDto(updated!)]);
  return { ok: true, task: out! };
}

export async function countActiveTasksByLink(
  db: Db,
  input: {
    adminUserId: number;
    threadIds?: string[];
    decisionIds?: string[];
  }
): Promise<{ threads: Record<string, number>; decisions: Record<string, number> }> {
  const activeStatuses = ["open", "in_progress", "blocked"] as const;
  const rows = await db
    .select({
      id: executiveOperationalTasks.id,
      threadId: executiveOperationalTasks.threadId,
      decisionId: executiveOperationalTasks.decisionId,
      status: executiveOperationalTasks.status,
    })
    .from(executiveOperationalTasks)
    .where(eq(executiveOperationalTasks.adminUserId, input.adminUserId));

  const threads: Record<string, number> = {};
  const decisions: Record<string, number> = {};

  for (const r of rows) {
    if (!activeStatuses.includes(r.status as (typeof activeStatuses)[number])) continue;
    if (r.threadId && (!input.threadIds?.length || input.threadIds.includes(r.threadId))) {
      threads[r.threadId] = (threads[r.threadId] ?? 0) + 1;
    }
    if (r.decisionId && (!input.decisionIds?.length || input.decisionIds.includes(r.decisionId))) {
      decisions[r.decisionId] = (decisions[r.decisionId] ?? 0) + 1;
    }
  }
  return { threads, decisions };
}

export async function buildExecutiveOperationalTasksForSkipper(
  db: Db,
  input: {
    adminUserId: number;
    subjectId?: string | null;
    threadId?: string | null;
    orderId?: string | null;
  }
) {
  const queue = await listExecutiveOperationalTasks(db, {
    adminUserId: input.adminUserId,
    subjectId: input.subjectId,
    threadId: input.threadId,
    orderId: input.orderId,
    limit: 40,
  });

  return {
    recommendationOnly: true,
    humanCoordinatedOnly: true,
    noAutonomousExecution: true,
    headline: "Operational task queue — owner must start/complete; Skipper recommends only.",
    open: queue.open.slice(0, 12),
    inProgress: queue.inProgress.slice(0, 8),
    blocked: queue.blocked.slice(0, 8),
    overdue: queue.overdue.slice(0, 8),
    recommendations: queue.recommendations,
    blockedInsights: analyzeBlockedOperationalTasks([
      ...queue.open,
      ...queue.inProgress,
      ...queue.blocked,
    ]).all.slice(0, 10),
    skipperTaskContext: queue.skipperTaskContext,
    generatedAt: queue.generatedAt,
  };
}
