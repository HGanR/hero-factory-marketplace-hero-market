import "server-only";

import { eq } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import * as schema from "@/lib/db/schema";
import { executiveOperationalTasks } from "@/lib/db/schema";
import {
  parseTaskCoordinationMetadata,
  serializeTaskCoordinationMetadata,
} from "@/lib/executive-agent/operator-task-metadata";
import type { RollbackStrategy } from "@/lib/executive-agent/executive-automation-types";
import { buildRollbackStrategy } from "@/lib/executive-agent/reversible-operational-actions";

type Db = MySql2Database<typeof schema>;

export type RollbackExecutionInput = {
  adminUserId: number;
  proposedAction: string;
  payloadJson: string;
  executionAuditId: string;
  rationale: string;
};

export type RollbackExecutionResult = {
  ok: boolean;
  message: string;
  partial: boolean;
  rollbackStrategy: RollbackStrategy;
};

export async function executeOperationalRollback(
  db: Db,
  input: RollbackExecutionInput
): Promise<RollbackExecutionResult> {
  const strategy = buildRollbackStrategy(input.proposedAction);

  if (!strategy.reversible) {
    return {
      ok: false,
      message: strategy.limitations[0] ?? "Action is not reversible.",
      partial: false,
      rollbackStrategy: strategy,
    };
  }

  if (input.proposedAction === "delegateOperationalTask") {
    return revertTaskCoordination(db, input, strategy, "delegation");
  }

  if (input.proposedAction === "escalateOperationalTask") {
    return revertTaskCoordination(db, input, strategy, "escalation");
  }

  return {
    ok: true,
    message: "Execution marked reversed in audit — physical records retained per policy.",
    partial: true,
    rollbackStrategy: strategy,
  };
}

async function revertTaskCoordination(
  db: Db,
  input: RollbackExecutionInput,
  strategy: RollbackStrategy,
  block: "delegation" | "escalation"
): Promise<RollbackExecutionResult> {
  let taskId: string | null = null;
  try {
    const payload = JSON.parse(input.payloadJson) as { taskId?: string };
    taskId = payload.taskId ?? null;
  } catch {
    taskId = null;
  }

  if (!taskId) {
    return {
      ok: false,
      message: "Rollback failed — taskId missing from execution payload.",
      partial: false,
      rollbackStrategy: strategy,
    };
  }

  const [row] = await db
    .select()
    .from(executiveOperationalTasks)
    .where(eq(executiveOperationalTasks.id, taskId))
    .limit(1);

  if (!row || row.adminUserId !== input.adminUserId) {
    return {
      ok: false,
      message: "Rollback failed — task not found for this desk.",
      partial: false,
      rollbackStrategy: strategy,
    };
  }

  const meta = parseTaskCoordinationMetadata(row.metadataJson);
  const coordination = block === "delegation" ? meta.delegation : meta.escalation;

  if (coordination?.acceptedAt) {
    return {
      ok: false,
      message: "Partial rollback only — delegation/escalation was already accepted by operator.",
      partial: true,
      rollbackStrategy: strategy,
    };
  }

  if (block === "delegation") {
    delete meta.delegation;
    if (meta.lastCoordinationAction === "delegate") delete meta.lastCoordinationAction;
  } else {
    delete meta.escalation;
    if (meta.lastCoordinationAction === "escalate") delete meta.lastCoordinationAction;
  }

  await db
    .update(executiveOperationalTasks)
    .set({
      metadataJson: serializeTaskCoordinationMetadata(meta),
      updatedAt: new Date(),
    })
    .where(eq(executiveOperationalTasks.id, taskId));

  return {
    ok: true,
    message: `${block} coordination metadata reverted for task ${taskId.slice(0, 8)}.`,
    partial: false,
    rollbackStrategy: strategy,
  };
}
