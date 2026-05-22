import "server-only";

import { desc, eq } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import { randomUUID } from "crypto";
import * as schema from "@/lib/db/schema";
import {
  executiveAgentMemoryItems,
  executiveOperationalDecisions,
  executiveOperationalTasks,
} from "@/lib/db/schema";
import { insertExecutiveAgentAuditLog } from "@/lib/executive-agent/executive-agent-audit";
import {
  PLANNING_PLANS,
  runExecutivePlanning,
} from "@/lib/executive-agent/executive-planning-engine";
import type {
  ExecutivePlanningEngineInput,
  ExecutivePlanningGenerateDto,
  ExecutivePlanningOverviewDto,
  PlanningPlanId,
} from "@/lib/executive-agent/executive-planning-types";
import { buildExecutiveKpiOverviewFromEngine } from "@/lib/fulfillment/executive-kpi-engine";
import { buildKpiEngineInput } from "@/lib/fulfillment/executive-kpi-service";
import { rowToTaskDto } from "@/lib/executive-agent/operational-task-service";
import { parseTaskCoordinationMetadata } from "@/lib/executive-agent/operator-task-metadata";
import { buildOperatorWorkloadAnalytics } from "@/lib/executive-agent/operator-workload-service";

type Db = MySql2Database<typeof schema>;

async function buildPlanningEngineInput(
  db: Db,
  input: { adminUserId: number; limit?: number }
): Promise<ExecutivePlanningEngineInput> {
  const limit = Math.min(Math.max(input.limit ?? 60, 1), 100);
  const kpi = await buildKpiEngineInput(db, { adminUserId: input.adminUserId, limit });

  const [memoryRows, decisionRows, taskRows] = await Promise.all([
    db
      .select({ title: executiveAgentMemoryItems.title, memoryType: executiveAgentMemoryItems.memoryType })
      .from(executiveAgentMemoryItems)
      .where(eq(executiveAgentMemoryItems.adminUserId, input.adminUserId))
      .orderBy(desc(executiveAgentMemoryItems.updatedAt))
      .limit(40),
    db
      .select({ status: executiveOperationalDecisions.status })
      .from(executiveOperationalDecisions)
      .where(eq(executiveOperationalDecisions.adminUserId, input.adminUserId))
      .limit(80),
    db
      .select()
      .from(executiveOperationalTasks)
      .where(eq(executiveOperationalTasks.adminUserId, input.adminUserId))
      .orderBy(desc(executiveOperationalTasks.updatedAt))
      .limit(150),
  ]);

  const tasks = taskRows.map(rowToTaskDto);
  const metadataByTaskId = new Map(
    taskRows.map((r) => [r.id, parseTaskCoordinationMetadata(r.metadataJson)] as const)
  );
  const operatorWorkload = buildOperatorWorkloadAnalytics({ tasks, metadataByTaskId });

  const strategicPriorityTitles = memoryRows
    .filter((m) => m.memoryType === "client_priority" || m.memoryType === "decision")
    .map((m) => m.title)
    .filter(Boolean) as string[];

  const openDecisionCount = decisionRows.filter((d) => d.status === "open").length;

  return {
    kpi,
    operatorWorkload,
    tasks,
    metadataByTaskId,
    strategicPriorityTitles,
    openDecisionCount,
  };
}

export async function buildExecutivePlanningOverview(
  db: Db,
  input: { adminUserId: number; limit?: number }
): Promise<ExecutivePlanningOverviewDto> {
  const engineInput = await buildPlanningEngineInput(db, input);
  const overview = buildExecutiveKpiOverviewFromEngine(engineInput.kpi);
  const openTasks = engineInput.tasks.filter(
    (t) => t.status === "open" || t.status === "in_progress" || t.status === "blocked"
  ).length;
  const overloadedOperators = engineInput.operatorWorkload.filter(
    (w) => w.balanceLabel === "overloaded"
  ).length;

  await insertExecutiveAgentAuditLog(db, {
    id: randomUUID(),
    adminUserId: input.adminUserId,
    prompt: null,
    toolName: "executive.planning.overview",
    actionType: "planning_overview_viewed",
    targetType: "platform",
    targetId: "planning",
    inputJson: null,
    outputJson: JSON.stringify({ plans: PLANNING_PLANS.length }).slice(0, 5000),
    approvalStatus: "not_required",
  });

  return {
    ok: true,
    plans: PLANNING_PLANS,
    deskPreview: {
      activeOrders: overview.totals.activeOrders,
      stalledOrders: overview.totals.stalledOrders,
      pendingApprovals: overview.totals.pendingApprovals,
      openTasks,
      overloadedOperators,
    },
    generatedAt: new Date().toISOString(),
    meta: {
      planningOnly: true,
      advisoryOnly: true,
      noAutonomousExecution: true,
      noProductionMutation: true,
      explainable: true,
      evidenceLinked: true,
      reversible: true,
    },
  };
}

export async function generateExecutivePlanningForAdmin(
  db: Db,
  input: {
    adminUserId: number;
    planId?: PlanningPlanId;
    horizonDays?: number;
    limit?: number;
  }
): Promise<ExecutivePlanningGenerateDto> {
  const engineInput = await buildPlanningEngineInput(db, input);
  const planId = input.planId ?? "multi_department_ops";
  const result = runExecutivePlanning(engineInput, planId, input.horizonDays ?? 14);

  await insertExecutiveAgentAuditLog(db, {
    id: randomUUID(),
    adminUserId: input.adminUserId,
    prompt: null,
    toolName: "executive.planning.generate",
    actionType: "planning_generated",
    targetType: "platform",
    targetId: planId,
    inputJson: JSON.stringify({
      planId,
      horizonDays: result.horizonDays,
    }).slice(0, 50_000),
    outputJson: JSON.stringify({
      steps: result.operationalRecovery.steps.length,
      confidence: result.confidence,
    }).slice(0, 50_000),
    approvalStatus: "not_required",
  });

  return {
    ok: true,
    result,
    generatedAt: result.generatedAt,
    meta: result.meta,
  };
}

/** Skipper read bundle — planning intelligence without execution. */
export async function buildExecutivePlanningForSkipper(
  db: Db,
  input: {
    adminUserId: number;
    planId?: PlanningPlanId;
    horizonDays?: number;
    limit?: number;
  }
) {
  const overview = await buildExecutivePlanningOverview(db, input);
  const generated = await generateExecutivePlanningForAdmin(db, input);
  const r = generated.result;

  return {
    planningOnly: true,
    noAutonomousExecution: true,
    plans: overview.plans.map((p) => ({ id: p.id, label: p.label })),
    deskPreview: overview.deskPreview,
    activePlan: {
      planId: r.planId,
      horizonDays: r.horizonDays,
      primarySteps: (
        r.planId === "operational_recovery"
          ? r.operationalRecovery
          : r.planId === "staffing_adjustment"
            ? r.staffingAdjustment
            : r.planId === "bottleneck_mitigation"
              ? r.bottleneckMitigation
              : r.planId === "campaign_sequencing"
                ? r.campaignSequencing
                : r.planId === "governance_scheduling"
                  ? r.governanceScheduling
                  : r.planId === "escalation_response"
                    ? r.escalationResponse
                    : r.planId === "workload_balance"
                      ? r.workloadBalance
                      : r.planId === "executive_initiative"
                        ? r.executiveInitiative
                        : r.multiDepartment
      ).steps.slice(0, 8),
      recoverySummary: r.operationalRecovery.summary,
      staffingSummary: r.staffingAdjustment.summary,
      initiativeSummary: r.executiveInitiative.summary,
      confidence: r.confidence,
      confidenceScore: r.confidenceScore,
    },
    skipperSummary: r.skipperSummary,
    generatedAt: r.generatedAt,
  };
}
