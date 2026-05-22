import "server-only";

import { randomUUID } from "crypto";
import { and, desc, eq } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import * as schema from "@/lib/db/schema";
import { executiveAgentApprovals, executiveOperationalTasks } from "@/lib/db/schema";
import { buildAgentApprovalRoute, validateAgentApprovalRouting } from "@/lib/executive-agent/agent-approval-routing";
import { isExecutiveDeskAgentId } from "@/lib/executive-agent/agent-capability-registry";
import { buildAgentTaskRouteRecommendation } from "@/lib/executive-agent/agent-task-routing";
import { buildExecutiveAgentCoordinationOverview } from "@/lib/executive-agent/executive-agent-coordination-engine";
import type {
  AgentTaskRouteRequest,
  AgentTaskRouteResult,
  ExecutiveAgentCoordinationOverviewDto,
  ExecutiveAgentWorkspacesDto,
} from "@/lib/executive-agent/executive-agent-coordination-types";
import { buildPersistentAgentWorkspaces } from "@/lib/executive-agent/persistent-agent-workspaces";
import { proposeOperationalTaskDelegation, proposeOperationalTaskEscalation } from "@/lib/executive-agent/delegated-task-coordination";
import { insertExecutiveAgentAuditLog } from "@/lib/executive-agent/executive-agent-audit";
import { listExecutiveOperationalThreads } from "@/lib/executive-agent/operational-thread-service";
import { rowToTaskDto } from "@/lib/executive-agent/operational-task-service";
import { buildOperatorWorkloadAnalytics } from "@/lib/executive-agent/operator-workload-service";
import { parseTaskCoordinationMetadata } from "@/lib/executive-agent/operator-task-metadata";

type Db = MySql2Database<typeof schema>;

async function buildCoordinationEngineInput(db: Db, adminUserId: number) {
  const [taskRows, threadList, approvalRows] = await Promise.all([
    db
      .select()
      .from(executiveOperationalTasks)
      .where(eq(executiveOperationalTasks.adminUserId, adminUserId))
      .orderBy(desc(executiveOperationalTasks.updatedAt))
      .limit(150),
    listExecutiveOperationalThreads(db, { adminUserId, limit: 80 }),
    db
      .select({ id: executiveAgentApprovals.id })
      .from(executiveAgentApprovals)
      .where(
        and(
          eq(executiveAgentApprovals.adminUserId, adminUserId),
          eq(executiveAgentApprovals.status, "pending")
        )
      )
      .limit(200),
  ]);

  const tasks = taskRows.map(rowToTaskDto);
  const metadataByTaskId = new Map(
    taskRows.map((r) => [r.id, parseTaskCoordinationMetadata(r.metadataJson)] as const)
  );
  const operatorWorkload = buildOperatorWorkloadAnalytics({ tasks, metadataByTaskId });

  return {
    tasks,
    threads: threadList.threads,
    operatorWorkload,
    pendingApprovalCount: approvalRows.length,
  };
}

export async function buildExecutiveAgentCoordinationOverviewForAdmin(
  db: Db,
  input: { adminUserId: number }
): Promise<ExecutiveAgentCoordinationOverviewDto> {
  const engineInput = await buildCoordinationEngineInput(db, input.adminUserId);
  const overview = buildExecutiveAgentCoordinationOverview(engineInput);

  await insertExecutiveAgentAuditLog(db, {
    id: randomUUID(),
    adminUserId: input.adminUserId,
    prompt: null,
    toolName: "executive.agents.overview",
    actionType: "agent_coordination_overview_viewed",
    targetType: "platform",
    targetId: "agents",
    inputJson: null,
    outputJson: JSON.stringify({
      workspaces: overview.workspaces.length,
      routes: overview.routeRecommendations.length,
      escalations: overview.escalationPaths.length,
    }).slice(0, 5000),
    approvalStatus: "not_required",
  });

  return { ok: true, ...overview };
}

export async function buildExecutiveAgentWorkspacesForAdmin(
  db: Db,
  input: { adminUserId: number }
): Promise<ExecutiveAgentWorkspacesDto> {
  const engineInput = await buildCoordinationEngineInput(db, input.adminUserId);
  const workspaces = buildPersistentAgentWorkspaces({
    tasks: engineInput.tasks,
    threads: engineInput.threads,
    pendingApprovalCount: engineInput.pendingApprovalCount,
  });

  await insertExecutiveAgentAuditLog(db, {
    id: randomUUID(),
    adminUserId: input.adminUserId,
    prompt: null,
    toolName: "executive.agents.workspaces",
    actionType: "agent_workspaces_viewed",
    targetType: "platform",
    targetId: "agents",
    inputJson: null,
    outputJson: JSON.stringify({ count: workspaces.length }).slice(0, 5000),
    approvalStatus: "not_required",
  });

  return {
    ok: true,
    workspaces,
    generatedAt: new Date().toISOString(),
    meta: {
      explainable: true,
      auditable: true,
      approvalAware: true,
      workloadAware: true,
      evidenceLinked: true,
      hierarchyGoverned: true,
      noUnrestrictedAutonomousExecution: true,
      departmentIsolationPreserved: true,
      rollbackControlsPreserved: true,
      executionPolicyPreserved: true,
    },
  };
}

export async function routeAgentTaskForAdmin(
  db: Db,
  input: { adminUserId: number } & AgentTaskRouteRequest
): Promise<
  AgentTaskRouteResult | { ok: false; error: string; code: string; httpStatus: number }
> {
  if (!isExecutiveDeskAgentId(input.targetAgentId)) {
    return { ok: false, error: "Invalid target agent.", code: "INVALID_AGENT", httpStatus: 400 };
  }

  const rationale = input.rationale.trim();
  if (!rationale) {
    return { ok: false, error: "Routing rationale is required.", code: "RATIONALE_REQUIRED", httpStatus: 400 };
  }

  const validation = validateAgentApprovalRouting({
    targetAgentId: input.targetAgentId,
    humanConfirmed: input.humanConfirmed,
  });

  if (input.humanConfirmed && !validation.allowed) {
    return {
      ok: false,
      error: validation.violations.join("; "),
      code: "ROUTING_DENIED",
      httpStatus: 403,
    };
  }

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

  if (!row) {
    return { ok: false, error: "Task not found.", code: "NOT_FOUND", httpStatus: 404 };
  }

  const task = rowToTaskDto(row);
  const recommendation = buildAgentTaskRouteRecommendation(task, input.targetAgentId);
  const approvalRoute = buildAgentApprovalRoute(recommendation);
  const routingId = randomUUID();

  let approvalProposal: AgentTaskRouteResult["approvalProposal"];

  if (input.humanConfirmed && recommendation.governedOperatorId) {
    const proposalInput = {
      adminUserId: input.adminUserId,
      taskId: input.taskId,
      targetOperatorId: recommendation.governedOperatorId,
      rationale,
    };

    const proposal =
      recommendation.approvalAction === "escalateOperationalTask"
        ? await proposeOperationalTaskEscalation(db, {
            ...proposalInput,
            priority: task.priority === "urgent" ? ("urgent" as const) : ("high" as const),
          })
        : await proposeOperationalTaskDelegation(db, proposalInput);

    if (proposal.ok) {
      approvalProposal = { approvalId: proposal.approvalId, message: proposal.message };
    } else {
      return {
        ok: false,
        error: proposal.message,
        code: proposal.code,
        httpStatus: proposal.httpStatus,
      };
    }
  }

  const result: AgentTaskRouteResult = {
    ok: true,
    routingId,
    recommendation,
    approvalRoute,
    approvalProposal,
    message: approvalProposal
      ? "Task routing queued for owner approval — no autonomous execution."
      : "Routing recommendation generated — set humanConfirmed to queue approval proposal.",
  };

  await insertExecutiveAgentAuditLog(db, {
    id: routingId,
    adminUserId: input.adminUserId,
    prompt: null,
    toolName: "executive.agents.route_task",
    actionType: "agent_task_routed",
    targetType: "task",
    targetId: input.taskId,
    inputJson: JSON.stringify({
      taskId: input.taskId,
      targetAgentId: input.targetAgentId,
      rationale,
      humanConfirmed: Boolean(input.humanConfirmed),
    }).slice(0, 5000),
    outputJson: JSON.stringify(result).slice(0, 8000),
    approvalStatus: approvalProposal ? "pending" : "not_required",
  });

  return result;
}

/** Skipper read bundle — coordination intelligence without execution. */
export async function buildExecutiveAgentCoordinationForSkipper(
  db: Db,
  input: { adminUserId: number }
) {
  const overview = await buildExecutiveAgentCoordinationOverviewForAdmin(db, input);

  return {
    monitoringOnly: true,
    noAutonomousExecution: true,
    agents: overview.agents.map((a) => ({
      agentId: a.agentId,
      displayName: a.displayName,
      domain: a.domain,
      canReceiveRoutedTasks: a.canReceiveRoutedTasks,
    })),
    workspaceSummary: overview.workspaces.map((w) => ({
      agentId: w.agentId,
      loadIndex: w.loadIndex,
      activeTasks: w.activeTasks,
      balanceLabel: w.balanceLabel,
    })),
    topRoutes: overview.routeRecommendations.slice(0, 6).map((r) => ({
      taskId: r.taskId,
      recommendedAgentId: r.recommendedAgentId,
      confidence: r.confidence,
      requiresApproval: r.requiresApproval,
    })),
    escalationCount: overview.escalationPaths.length,
    skipperSummary: overview.skipperSummary,
    generatedAt: overview.generatedAt,
  };
}
