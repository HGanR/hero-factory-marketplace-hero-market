import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import * as schema from "@/lib/db/schema";
import { executiveOperationalTasks } from "@/lib/db/schema";
import { insertExecutiveApproval } from "@/lib/executive-agent/executive-agent-approvals-store";
import { insertExecutiveAgentAuditLog } from "@/lib/executive-agent/executive-agent-audit";
import {
  getExecutiveOperator,
  isExecutiveOperatorId,
} from "@/lib/executive-agent/executive-operator-registry";
import type { ExecutiveOperatorId, TaskCoordinationMetadata } from "@/lib/executive-agent/executive-operator-types";
import {
  parseTaskCoordinationMetadata,
  serializeTaskCoordinationMetadata,
} from "@/lib/executive-agent/operator-task-metadata";
import {
  nextEscalationTarget,
  resolveEscalationChain,
  validateEscalationTarget,
} from "@/lib/executive-agent/escalation-chain-service";

type Db = MySql2Database<typeof schema>;

export const DELEGATE_OPERATIONAL_TASK_ACTION = "delegateOperationalTask";
export const ESCALATE_OPERATIONAL_TASK_ACTION = "escalateOperationalTask";

export type DelegateTaskPayload = {
  taskId: string;
  targetOperatorId: ExecutiveOperatorId;
  rationale: string;
};

export type EscalateTaskPayload = {
  taskId: string;
  targetOperatorId: ExecutiveOperatorId;
  rationale: string;
  priority?: "normal" | "high" | "urgent";
};

export async function applyApprovedTaskDelegation(
  db: Db,
  input: {
    adminUserId: number;
    approvalId: string;
    taskId: string;
    payload: DelegateTaskPayload;
  }
): Promise<void> {
  const [row] = await db
    .select()
    .from(executiveOperationalTasks)
    .where(eq(executiveOperationalTasks.id, input.taskId))
    .limit(1);
  if (!row) return;

  const meta = parseTaskCoordinationMetadata(row.metadataJson);
  const now = new Date().toISOString();
  meta.delegation = {
    status: "approved",
    targetOperatorId: input.payload.targetOperatorId,
    proposedByAdminUserId: input.adminUserId,
    proposedAt: meta.delegation?.proposedAt ?? now,
    approvedAt: now,
    approvalId: input.approvalId,
    rationale: input.payload.rationale,
    acceptanceRequired: true,
    acceptedAt: null,
  };
  meta.lastCoordinationAction = "delegate";

  await db
    .update(executiveOperationalTasks)
    .set({
      ownerLabel: `delegated_${input.payload.targetOperatorId}`.slice(0, 64),
      metadataJson: serializeTaskCoordinationMetadata(meta),
      updatedAt: new Date(),
    })
    .where(eq(executiveOperationalTasks.id, input.taskId));
}

export async function applyApprovedTaskEscalation(
  db: Db,
  input: {
    adminUserId: number;
    approvalId: string;
    taskId: string;
    payload: EscalateTaskPayload;
  }
): Promise<void> {
  const [row] = await db
    .select()
    .from(executiveOperationalTasks)
    .where(eq(executiveOperationalTasks.id, input.taskId))
    .limit(1);
  if (!row) return;

  const meta = parseTaskCoordinationMetadata(row.metadataJson);
  const chain = resolveEscalationChain(
    row.department as import("@/lib/fulfillment/fulfillment-orchestration-types").FulfillmentOrchestrationDepartment | null
  );
  const step = chain.steps.find((s) => s.operatorId === input.payload.targetOperatorId);
  const now = new Date().toISOString();

  meta.escalation = {
    status: "approved",
    chainId: chain.id,
    level: step?.level ?? (meta.escalation?.level ?? 0) + 1,
    targetOperatorId: input.payload.targetOperatorId,
    proposedAt: meta.escalation?.proposedAt ?? now,
    approvedAt: now,
    approvalId: input.approvalId,
    rationale: input.payload.rationale,
    priority: input.payload.priority ?? "high",
  };
  meta.lastCoordinationAction = "escalate";

  const priority =
    input.payload.priority === "urgent"
      ? "urgent"
      : input.payload.priority === "high"
        ? "high"
        : row.priority;

  await db
    .update(executiveOperationalTasks)
    .set({
      priority,
      metadataJson: serializeTaskCoordinationMetadata(meta),
      updatedAt: new Date(),
    })
    .where(eq(executiveOperationalTasks.id, input.taskId));
}

export async function proposeOperationalTaskDelegation(
  db: Db,
  input: { adminUserId: number; taskId: string; targetOperatorId: string; rationale: string }
): Promise<
  | { ok: true; approvalId: string; message: string }
  | { ok: false; code: string; message: string; httpStatus: number; approvalId?: string }
> {
  if (!isExecutiveOperatorId(input.targetOperatorId)) {
    return { ok: false, code: "invalid_operator", message: "Unknown operator id.", httpStatus: 400 };
  }
  const op = getExecutiveOperator(input.targetOperatorId);
  if (!op?.canReceiveDelegation) {
    return { ok: false, code: "operator_cannot_receive", message: "Target cannot receive delegation.", httpStatus: 400 };
  }

  const rationale = input.rationale.trim();
  if (!rationale) {
    return { ok: false, code: "empty_rationale", message: "Rationale is required.", httpStatus: 400 };
  }

  const [row] = await db
    .select()
    .from(executiveOperationalTasks)
    .where(eq(executiveOperationalTasks.id, input.taskId))
    .limit(1);

  if (!row || row.adminUserId !== input.adminUserId) {
    return { ok: false, code: "task_not_found", message: "Task not found.", httpStatus: 404 };
  }
  if (row.status === "completed" || row.status === "canceled") {
    return { ok: false, code: "task_not_active", message: "Task is not active.", httpStatus: 409 };
  }

  const meta = parseTaskCoordinationMetadata(row.metadataJson);
  if (meta.delegation?.status === "proposed") {
    return {
      ok: false,
      code: "delegation_already_pending",
      message: "Delegation already pending approval.",
      httpStatus: 409,
      approvalId: meta.delegation.approvalId ?? undefined,
    };
  }

  const approvalId = randomUUID();
  const now = new Date().toISOString();
  const payload: DelegateTaskPayload = {
    taskId: input.taskId,
    targetOperatorId: input.targetOperatorId,
    rationale: rationale.slice(0, 2000),
  };

  meta.delegation = {
    status: "proposed",
    targetOperatorId: input.targetOperatorId,
    proposedByAdminUserId: input.adminUserId,
    proposedAt: now,
    approvedAt: null,
    approvalId,
    rationale: payload.rationale,
    acceptanceRequired: true,
    acceptedAt: null,
  };
  meta.lastCoordinationAction = "delegate";

  await insertExecutiveApproval(db, {
    id: approvalId,
    adminUserId: input.adminUserId,
    proposedAction: DELEGATE_OPERATIONAL_TASK_ACTION,
    targetType: "executive_operational_task",
    targetId: input.taskId,
    payloadJson: JSON.stringify(payload),
  });

  await db
    .update(executiveOperationalTasks)
    .set({
      metadataJson: serializeTaskCoordinationMetadata(meta),
      approvalId,
      updatedAt: new Date(),
    })
    .where(eq(executiveOperationalTasks.id, input.taskId));

  await insertExecutiveAgentAuditLog(db, {
    id: randomUUID(),
    adminUserId: input.adminUserId,
    prompt: null,
    toolName: DELEGATE_OPERATIONAL_TASK_ACTION,
    actionType: "write_proposal",
    targetType: "approval_queue",
    targetId: approvalId,
    inputJson: JSON.stringify({ taskId: input.taskId, targetOperatorId: input.targetOperatorId }).slice(0, 50_000),
    outputJson: null,
    approvalStatus: "pending",
  });

  return {
    ok: true,
    approvalId,
    message:
      "Delegation proposed — awaits owner approval. Target operator must accept; no autonomous delegation acceptance.",
  };
}

export async function proposeOperationalTaskEscalation(
  db: Db,
  input: {
    adminUserId: number;
    taskId: string;
    targetOperatorId?: string | null;
    rationale: string;
    priority?: "normal" | "high" | "urgent";
  }
): Promise<
  | { ok: true; approvalId: string; message: string; targetOperatorId: ExecutiveOperatorId }
  | { ok: false; code: string; message: string; httpStatus: number; approvalId?: string }
> {
  const rationale = input.rationale.trim();
  if (!rationale) {
    return { ok: false, code: "empty_rationale", message: "Rationale is required.", httpStatus: 400 };
  }

  const [row] = await db
    .select()
    .from(executiveOperationalTasks)
    .where(eq(executiveOperationalTasks.id, input.taskId))
    .limit(1);

  if (!row || row.adminUserId !== input.adminUserId) {
    return { ok: false, code: "task_not_found", message: "Task not found.", httpStatus: 404 };
  }
  if (row.status === "completed" || row.status === "canceled") {
    return { ok: false, code: "task_not_active", message: "Task is not active.", httpStatus: 409 };
  }

  const dept = row.department as import("@/lib/fulfillment/fulfillment-orchestration-types").FulfillmentOrchestrationDepartment | null;
  const meta = parseTaskCoordinationMetadata(row.metadataJson);
  const currentLevel = meta.escalation?.level ?? 0;
  const suggested = nextEscalationTarget({ department: dept, currentLevel });
  const targetOperatorId = (input.targetOperatorId?.trim() ||
    suggested?.operatorId ||
    "executive_owner") as ExecutiveOperatorId;

  if (!validateEscalationTarget(targetOperatorId)) {
    return { ok: false, code: "invalid_escalation_target", message: "Invalid escalation target.", httpStatus: 400 };
  }

  if (meta.escalation?.status === "proposed") {
    return {
      ok: false,
      code: "escalation_already_pending",
      message: "Escalation already pending approval.",
      httpStatus: 409,
      approvalId: meta.escalation.approvalId ?? undefined,
    };
  }

  const approvalId = randomUUID();
  const now = new Date().toISOString();
  const chain = resolveEscalationChain(dept);
  const step = chain.steps.find((s) => s.operatorId === targetOperatorId);
  const payload: EscalateTaskPayload = {
    taskId: input.taskId,
    targetOperatorId,
    rationale: rationale.slice(0, 2000),
    priority: input.priority ?? "high",
  };

  meta.escalation = {
    status: "proposed",
    chainId: chain.id,
    level: step?.level ?? currentLevel + 1,
    targetOperatorId,
    proposedAt: now,
    approvedAt: null,
    approvalId,
    rationale: payload.rationale,
    priority: payload.priority ?? "high",
  };
  meta.lastCoordinationAction = "escalate";

  await insertExecutiveApproval(db, {
    id: approvalId,
    adminUserId: input.adminUserId,
    proposedAction: ESCALATE_OPERATIONAL_TASK_ACTION,
    targetType: "executive_operational_task",
    targetId: input.taskId,
    payloadJson: JSON.stringify(payload),
  });

  await db
    .update(executiveOperationalTasks)
    .set({
      metadataJson: serializeTaskCoordinationMetadata(meta),
      approvalId,
      updatedAt: new Date(),
    })
    .where(eq(executiveOperationalTasks.id, input.taskId));

  await insertExecutiveAgentAuditLog(db, {
    id: randomUUID(),
    adminUserId: input.adminUserId,
    prompt: null,
    toolName: ESCALATE_OPERATIONAL_TASK_ACTION,
    actionType: "write_proposal",
    targetType: "approval_queue",
    targetId: approvalId,
    inputJson: JSON.stringify({ taskId: input.taskId, targetOperatorId }).slice(0, 50_000),
    outputJson: null,
    approvalStatus: "pending",
  });

  return {
    ok: true,
    approvalId,
    targetOperatorId,
    message:
      "Escalation proposed — awaits owner approval. No autonomous escalation execution.",
  };
}

export function mergeCoordinationIntoTaskDto<T extends { id: string }>(
  dto: T,
  metadataJson: string | null
): T & { coordination: TaskCoordinationMetadata } {
  return { ...dto, coordination: parseTaskCoordinationMetadata(metadataJson) };
}
