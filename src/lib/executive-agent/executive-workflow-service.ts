import "server-only";

import { randomUUID } from "crypto";
import { and, desc, eq, inArray } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import * as schema from "@/lib/db/schema";
import { executiveAgentApprovals, executiveAgentAuditLogs, executiveOperationalTasks } from "@/lib/db/schema";
import { insertExecutiveAgentAuditLog } from "@/lib/executive-agent/executive-agent-audit";
import { buildExecutiveWorkflowFabricOverview } from "@/lib/executive-agent/executive-workflow-fabric";
import type {
  ExecutiveWorkflowDetailDto,
  ExecutiveWorkflowFabricOverviewDto,
  WorkflowPauseResumeResult,
} from "@/lib/executive-agent/executive-workflow-types";
import { findWorkflowStateById, buildPersistentWorkflowStates } from "@/lib/executive-agent/persistent-workflow-state";
import { buildOperationalLifecycleSupervision } from "@/lib/executive-agent/operational-lifecycle-supervision";
import { listExecutiveOperationalThreads } from "@/lib/executive-agent/operational-thread-service";
import { rowToTaskDto } from "@/lib/executive-agent/operational-task-service";

type Db = MySql2Database<typeof schema>;

const WORKFLOW_AUDIT_ACTIONS = ["workflow_paused", "workflow_resumed"] as const;

async function loadPausedWorkflowState(db: Db, adminUserId: number) {
  const rows = await db
    .select()
    .from(executiveAgentAuditLogs)
    .where(
      and(
        eq(executiveAgentAuditLogs.adminUserId, adminUserId),
        inArray(executiveAgentAuditLogs.actionType, [...WORKFLOW_AUDIT_ACTIONS])
      )
    )
    .orderBy(desc(executiveAgentAuditLogs.createdAt))
    .limit(300);

  const pausedWorkflowIds = new Set<string>();
  const pauseMetaByWorkflowId = new Map<string, { pausedAt: string; rationale: string }>();
  const lastActionByWorkflow = new Map<string, string>();

  for (const row of rows) {
    let workflowId: string | null = null;
    let rationale = "";
    try {
      const input = JSON.parse(row.inputJson ?? "{}") as { workflowId?: string; rationale?: string };
      workflowId = input.workflowId ?? row.targetId;
      rationale = input.rationale ?? "";
    } catch {
      workflowId = row.targetId;
    }
    if (!workflowId || lastActionByWorkflow.has(workflowId)) continue;
    lastActionByWorkflow.set(workflowId, row.actionType);
    if (row.actionType === "workflow_paused") {
      pausedWorkflowIds.add(workflowId);
      pauseMetaByWorkflowId.set(workflowId, {
        pausedAt: row.createdAt?.toISOString?.() ?? new Date().toISOString(),
        rationale,
      });
    }
  }

  return { pausedWorkflowIds, pauseMetaByWorkflowId };
}

async function buildWorkflowEngineInput(db: Db, adminUserId: number) {
  const [taskRows, threadList, approvalRows, pauseState] = await Promise.all([
    db
      .select()
      .from(executiveOperationalTasks)
      .where(eq(executiveOperationalTasks.adminUserId, adminUserId))
      .orderBy(desc(executiveOperationalTasks.updatedAt))
      .limit(150),
    listExecutiveOperationalThreads(db, { adminUserId, limit: 80 }),
    db
      .select()
      .from(executiveAgentApprovals)
      .where(eq(executiveAgentApprovals.adminUserId, adminUserId))
      .orderBy(desc(executiveAgentApprovals.createdAt))
      .limit(200),
    loadPausedWorkflowState(db, adminUserId),
  ]);

  return {
    tasks: taskRows.map(rowToTaskDto),
    threads: threadList.threads,
    approvals: approvalRows.map((a) => ({
      id: a.id,
      proposedAction: a.proposedAction,
      status: a.status,
      targetId: a.targetId,
    })),
    ...pauseState,
  };
}

export async function buildExecutiveWorkflowFabricOverviewForAdmin(
  db: Db,
  input: { adminUserId: number }
): Promise<ExecutiveWorkflowFabricOverviewDto> {
  const engineInput = await buildWorkflowEngineInput(db, input.adminUserId);
  const overview = buildExecutiveWorkflowFabricOverview(engineInput);

  await insertExecutiveAgentAuditLog(db, {
    id: randomUUID(),
    adminUserId: input.adminUserId,
    prompt: null,
    toolName: "executive.workflows.overview",
    actionType: "workflow_fabric_overview_viewed",
    targetType: "platform",
    targetId: "workflows",
    inputJson: null,
    outputJson: JSON.stringify({
      workflows: overview.workflows.length,
      paused: overview.pausedWorkflowCount,
      blocked: overview.blockedWorkflowCount,
    }).slice(0, 5000),
    approvalStatus: "not_required",
  });

  return { ok: true, ...overview };
}

export async function buildExecutiveWorkflowDetailForAdmin(
  db: Db,
  input: { adminUserId: number; workflowId: string }
): Promise<ExecutiveWorkflowDetailDto | null> {
  const engineInput = await buildWorkflowEngineInput(db, input.adminUserId);
  const workflows = buildPersistentWorkflowStates(engineInput);
  const workflow = findWorkflowStateById(workflows, input.workflowId);
  if (!workflow) return null;

  const bundle = buildOperationalLifecycleSupervision({
    workflow,
    tasks: engineInput.tasks,
    approvals: engineInput.approvals,
  });

  await insertExecutiveAgentAuditLog(db, {
    id: randomUUID(),
    adminUserId: input.adminUserId,
    prompt: null,
    toolName: "executive.workflows.detail",
    actionType: "workflow_detail_viewed",
    targetType: "workflow",
    targetId: input.workflowId,
    inputJson: null,
    outputJson: JSON.stringify({ stage: workflow.currentStage }).slice(0, 5000),
    approvalStatus: "not_required",
  });

  return {
    ok: true,
    workflow,
    dependencyGraph: bundle.dependencyGraph,
    approvalChain: bundle.approvalChain,
    continuity: bundle.continuity,
    bottlenecks: bundle.bottlenecks,
    recoveryOptions: bundle.recoveryOptions,
    supervision: bundle.supervision,
    generatedAt: new Date().toISOString(),
    meta: {
      explainable: true,
      auditable: true,
      approvalAware: true,
      dependencyAware: true,
      lifecycleAware: true,
      rollbackAware: true,
      noUnrestrictedAutonomousExecution: true,
      noAutonomousDeploy: true,
      noAutonomousPublish: true,
      noAutonomousSpend: true,
      noAutonomousGovernanceMutation: true,
      noWorkflowApprovalBypass: true,
      departmentIsolationPreserved: true,
    },
  };
}

async function pauseOrResumeWorkflow(
  db: Db,
  input: {
    adminUserId: number;
    workflowId: string;
    action: "pause" | "resume";
    rationale: string;
    humanConfirmed: boolean;
  }
): Promise<WorkflowPauseResumeResult | { ok: false; error: string; code: string; httpStatus: number }> {
  if (!input.humanConfirmed) {
    return {
      ok: false,
      error: "humanConfirmed=true required for workflow pause/resume.",
      code: "HUMAN_CONFIRMATION_REQUIRED",
      httpStatus: 400,
    };
  }

  const engineInput = await buildWorkflowEngineInput(db, input.adminUserId);
  const workflows = buildPersistentWorkflowStates(engineInput);
  const workflow = findWorkflowStateById(workflows, input.workflowId);
  if (!workflow) {
    return { ok: false, error: "Workflow not found.", code: "NOT_FOUND", httpStatus: 404 };
  }

  if (input.action === "pause" && workflow.paused) {
    return { ok: false, error: "Workflow already paused.", code: "ALREADY_PAUSED", httpStatus: 409 };
  }
  if (input.action === "resume" && !workflow.paused) {
    return { ok: false, error: "Workflow is not paused.", code: "NOT_PAUSED", httpStatus: 409 };
  }

  const auditId = randomUUID();
  const actionType = input.action === "pause" ? "workflow_paused" : "workflow_resumed";

  await insertExecutiveAgentAuditLog(db, {
    id: auditId,
    adminUserId: input.adminUserId,
    prompt: null,
    toolName: `executive.workflows.${input.action}`,
    actionType,
    targetType: "workflow",
    targetId: input.workflowId,
    inputJson: JSON.stringify({
      workflowId: input.workflowId,
      rationale: input.rationale,
      humanConfirmed: input.humanConfirmed,
    }).slice(0, 5000),
    outputJson: JSON.stringify({ action: input.action }).slice(0, 2000),
    approvalStatus: "executed",
  });

  const refreshedInput = await buildWorkflowEngineInput(db, input.adminUserId);
  const refreshed = findWorkflowStateById(buildPersistentWorkflowStates(refreshedInput), input.workflowId);

  return {
    ok: true,
    workflowId: input.workflowId,
    action: input.action,
    auditId,
    message:
      input.action === "pause"
        ? "Workflow paused — no autonomous resume; use resume with humanConfirmed."
        : "Workflow resumed at governed lifecycle stage.",
    workflow: refreshed ?? undefined,
  };
}

export async function pauseExecutiveWorkflowForAdmin(
  db: Db,
  input: { adminUserId: number; workflowId: string; rationale: string; humanConfirmed: boolean }
) {
  return pauseOrResumeWorkflow(db, { ...input, action: "pause" });
}

export async function resumeExecutiveWorkflowForAdmin(
  db: Db,
  input: { adminUserId: number; workflowId: string; rationale: string; humanConfirmed: boolean }
) {
  return pauseOrResumeWorkflow(db, { ...input, action: "resume" });
}
