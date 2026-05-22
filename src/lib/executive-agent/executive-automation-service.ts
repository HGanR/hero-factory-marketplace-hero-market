import "server-only";

import { randomUUID } from "crypto";
import { and, desc, eq, inArray } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import * as schema from "@/lib/db/schema";
import { executiveAgentAuditLogs } from "@/lib/db/schema";
import { executeExecutiveApprovedAction } from "@/lib/executive-agent/executive-action-executors";
import {
  getExecutiveApprovalById,
  setExecutiveApprovalStatus,
} from "@/lib/executive-agent/executive-agent-approvals-store";
import { insertExecutiveAgentAuditLog } from "@/lib/executive-agent/executive-agent-audit";
import {
  buildAutomationMeta,
  prepareGovernedAutomationExecution,
} from "@/lib/executive-agent/executive-automation-engine";
import type {
  ApprovalSource,
  AutomationExecutionResult,
  AutomationHistoryDto,
  AutomationHistoryEntry,
  AutomationRollbackResult,
} from "@/lib/executive-agent/executive-automation-types";
import { executeOperationalRollback } from "@/lib/executive-agent/operational-rollback-engine";
import { buildRollbackStrategy } from "@/lib/executive-agent/reversible-operational-actions";

type Db = MySql2Database<typeof schema>;

const AUTOMATION_ACTION_TYPES = [
  "automation_executed",
  "automation_rollback",
  "automation_policy_denied",
] as const;

function parseAuditOutput(raw: string | null): Record<string, unknown> {
  if (!raw?.trim()) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

export async function executeGovernedAutomationForAdmin(
  db: Db,
  input: {
    adminUserId: number;
    approvalId: string;
    approvalSource: ApprovalSource;
    humanConfirmed: boolean;
  }
): Promise<
  | AutomationExecutionResult
  | { ok: false; error: string; code: string; httpStatus: number; policyValidation?: unknown }
> {
  const row = await getExecutiveApprovalById(db, input.approvalId, input.adminUserId);
  if (!row) {
    return { ok: false, error: "NOT_FOUND", code: "NOT_FOUND", httpStatus: 404 };
  }

  const prepared = prepareGovernedAutomationExecution({
    approvalId: row.id,
    proposedAction: row.proposedAction,
    payloadJson: row.payloadJson,
    targetType: row.targetType,
    targetId: row.targetId,
    status: row.status,
    adminUserId: input.adminUserId,
    approvalOwnerAdminUserId: row.adminUserId,
    humanConfirmed: input.humanConfirmed,
    approvalSource: input.approvalSource,
  });

  if (!prepared.ok) {
    if (prepared.code === "POLICY_DENIED" && prepared.policyValidation) {
      const deniedId = randomUUID();
      await insertExecutiveAgentAuditLog(db, {
        id: deniedId,
        adminUserId: input.adminUserId,
        prompt: null,
        toolName: "executive.automation.execute",
        actionType: "automation_policy_denied",
        targetType: "approval",
        targetId: row.id,
        inputJson: JSON.stringify({
          approvalId: row.id,
          proposedAction: row.proposedAction,
          approvalSource: input.approvalSource,
        }).slice(0, 5000),
        outputJson: JSON.stringify({
          violations: prepared.policyValidation.violations,
        }).slice(0, 5000),
        approvalStatus: "rejected",
      });
    }

    return {
      ok: false,
      error: prepared.message,
      code: prepared.code,
      httpStatus: prepared.httpStatus,
      policyValidation: prepared.policyValidation,
    };
  }

  const { preview } = prepared;
  const executionId = randomUUID();
  const executedAt = new Date().toISOString();

  await setExecutiveApprovalStatus(db, row.id, input.adminUserId, "approved");

  const exec = await executeExecutiveApprovedAction(db, {
    adminUserId: input.adminUserId,
    approval: { ...row, status: "approved" },
  });

  await setExecutiveApprovalStatus(db, row.id, input.adminUserId, exec.ok ? "executed" : "failed", {
    executedAt: new Date(),
  });

  const executionAudit = {
    auditId: executionId,
    approvalId: row.id,
    executedAt,
    executedByAdminUserId: input.adminUserId,
    proposedAction: row.proposedAction,
    ok: exec.ok,
    message: exec.message,
  };

  const result: AutomationExecutionResult = {
    ok: exec.ok,
    executionId,
    approvalId: row.id,
    executionPlan: preview.executionPlan,
    approvalSource: input.approvalSource,
    rollbackStrategy: preview.rollbackStrategy,
    executionAudit,
    policyValidation: preview.policyValidation,
    executorResult: {
      status: exec.status,
      message: exec.message,
      data: exec.data,
    },
    meta: buildAutomationMeta(preview.policyValidation.departmentIsolationOk),
  };

  await insertExecutiveAgentAuditLog(db, {
    id: executionId,
    adminUserId: input.adminUserId,
    prompt: null,
    toolName: "executive.automation.execute",
    actionType: "automation_executed",
    targetType: "approval",
    targetId: row.id,
    inputJson: JSON.stringify({
      approvalId: row.id,
      approvalSource: input.approvalSource,
      humanConfirmed: input.humanConfirmed,
      proposedAction: row.proposedAction,
      payloadJson: row.payloadJson,
    }).slice(0, 5000),
    outputJson: JSON.stringify(result).slice(0, 12_000),
    approvalStatus: exec.ok ? "executed" : "failed",
  });

  return result;
}

export async function rollbackGovernedAutomationForAdmin(
  db: Db,
  input: { adminUserId: number; executionAuditId: string; rationale: string }
): Promise<
  AutomationRollbackResult | { ok: false; error: string; code: string; httpStatus: number }
> {
  const rationale = input.rationale.trim();
  if (!rationale) {
    return {
      ok: false,
      error: "Rollback rationale is required.",
      code: "RATIONALE_REQUIRED",
      httpStatus: 400,
    };
  }

  const [auditRow] = await db
    .select()
    .from(executiveAgentAuditLogs)
    .where(
      and(
        eq(executiveAgentAuditLogs.id, input.executionAuditId),
        eq(executiveAgentAuditLogs.adminUserId, input.adminUserId),
        eq(executiveAgentAuditLogs.actionType, "automation_executed")
      )
    )
    .limit(1);

  if (!auditRow) {
    return { ok: false, error: "Execution audit not found.", code: "NOT_FOUND", httpStatus: 404 };
  }

  const inputJson = parseAuditOutput(auditRow.inputJson);
  const proposedAction =
    typeof inputJson.proposedAction === "string" ? inputJson.proposedAction : "";
  const payloadJson = typeof inputJson.payloadJson === "string" ? inputJson.payloadJson : "{}";
  const approvalId =
    typeof inputJson.approvalId === "string"
      ? inputJson.approvalId
      : (auditRow.targetId ?? "");

  const rollbackResult = await executeOperationalRollback(db, {
    adminUserId: input.adminUserId,
    proposedAction,
    payloadJson,
    executionAuditId: input.executionAuditId,
    rationale,
  });

  const rollbackId = randomUUID();
  const response: AutomationRollbackResult = {
    ok: rollbackResult.ok,
    rollbackId,
    executionAuditId: input.executionAuditId,
    rollbackStrategy: rollbackResult.rollbackStrategy,
    message: rollbackResult.message,
    partial: rollbackResult.partial,
  };

  await insertExecutiveAgentAuditLog(db, {
    id: rollbackId,
    adminUserId: input.adminUserId,
    prompt: null,
    toolName: "executive.automation.rollback",
    actionType: "automation_rollback",
    targetType: "audit",
    targetId: input.executionAuditId,
    inputJson: JSON.stringify({
      executionAuditId: input.executionAuditId,
      approvalId,
      rationale,
    }).slice(0, 5000),
    outputJson: JSON.stringify(response).slice(0, 8000),
    approvalStatus: rollbackResult.ok ? "executed" : "failed",
  });

  return response;
}

export async function listAutomationHistoryForAdmin(
  db: Db,
  input: { adminUserId: number; limit?: number }
): Promise<AutomationHistoryDto> {
  const limit = Math.min(Math.max(input.limit ?? 40, 1), 100);

  const rows = await db
    .select()
    .from(executiveAgentAuditLogs)
    .where(
      and(
        eq(executiveAgentAuditLogs.adminUserId, input.adminUserId),
        inArray(executiveAgentAuditLogs.actionType, [...AUTOMATION_ACTION_TYPES])
      )
    )
    .orderBy(desc(executiveAgentAuditLogs.createdAt))
    .limit(limit);

  const entries: AutomationHistoryEntry[] = rows.map((row) => {
    const rowInput = parseAuditOutput(row.inputJson);
    const outputJson = parseAuditOutput(row.outputJson);
    const kind =
      row.actionType === "automation_executed"
        ? "execution"
        : row.actionType === "automation_rollback"
          ? "rollback"
          : "policy_denied";

    const proposedAction =
      typeof rowInput.proposedAction === "string"
        ? rowInput.proposedAction
        : typeof outputJson.proposedAction === "string"
          ? outputJson.proposedAction
          : null;

    const approvalSource =
      typeof rowInput.approvalSource === "string"
        ? (rowInput.approvalSource as ApprovalSource)
        : null;

    const ok =
      kind === "policy_denied"
        ? false
        : kind === "rollback"
          ? outputJson.ok === true
          : outputJson.ok === true;

    const message =
      typeof outputJson.message === "string"
        ? outputJson.message
        : kind === "policy_denied"
          ? "Policy denied"
          : kind;

    const reversible = proposedAction ? buildRollbackStrategy(proposedAction).reversible : false;

    return {
      id: row.id,
      kind,
      approvalId:
        typeof rowInput.approvalId === "string"
          ? rowInput.approvalId
          : row.targetType === "approval"
            ? row.targetId
            : null,
      proposedAction,
      ok,
      message,
      approvalSource,
      createdAt: row.createdAt?.toISOString?.() ?? new Date().toISOString(),
      reversible,
    };
  });

  return {
    ok: true,
    entries,
    generatedAt: new Date().toISOString(),
  };
}

/** Skipper read-only automation history — no execution. */
export async function buildExecutiveAutomationHistoryForSkipper(
  db: Db,
  input: { adminUserId: number; limit?: number }
) {
  const history = await listAutomationHistoryForAdmin(db, input);
  return {
    monitoringOnly: true,
    noAutonomousExecution: true,
    recentExecutions: history.entries.filter((e) => e.kind === "execution").slice(0, 10),
    recentRollbacks: history.entries.filter((e) => e.kind === "rollback").slice(0, 5),
    policyDenials: history.entries.filter((e) => e.kind === "policy_denied").length,
    generatedAt: history.generatedAt,
  };
}
