import "server-only";

import { desc, eq } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import * as schema from "@/lib/db/schema";
import { executiveOperationalTasks } from "@/lib/db/schema";
import { randomUUID } from "crypto";
import { insertExecutiveAgentAuditLog } from "@/lib/executive-agent/executive-agent-audit";
import {
  runExecutiveSimulation,
  SIMULATION_SCENARIOS,
} from "@/lib/executive-agent/executive-simulation-engine";
import type {
  ExecutiveSimulationEngineInput,
  ExecutiveSimulationOverviewDto,
  ExecutiveSimulationRunDto,
  SimulationScenarioAssumptions,
  SimulationScenarioId,
} from "@/lib/executive-agent/executive-simulation-types";
import { buildExecutiveKpiOverviewFromEngine } from "@/lib/fulfillment/executive-kpi-engine";
import { buildKpiEngineInput } from "@/lib/fulfillment/executive-kpi-service";
import { buildOperatorWorkloadAnalytics } from "@/lib/executive-agent/operator-workload-service";
import { rowToTaskDto } from "@/lib/executive-agent/operational-task-service";
import { parseTaskCoordinationMetadata } from "@/lib/executive-agent/operator-task-metadata";
import { buildFulfillmentVelocitySnapshot } from "@/lib/fulfillment/executive-kpi-engine";

type Db = MySql2Database<typeof schema>;

async function buildSimulationEngineInput(
  db: Db,
  input: { adminUserId: number; limit?: number }
): Promise<ExecutiveSimulationEngineInput> {
  const limit = Math.min(Math.max(input.limit ?? 60, 1), 100);
  const kpi = await buildKpiEngineInput(db, { adminUserId: input.adminUserId, limit });

  const taskRows = await db
    .select()
    .from(executiveOperationalTasks)
    .where(eq(executiveOperationalTasks.adminUserId, input.adminUserId))
    .orderBy(desc(executiveOperationalTasks.updatedAt))
    .limit(150);

  const tasks = taskRows.map(rowToTaskDto);
  const metadataByTaskId = new Map(
    taskRows.map((r) => [r.id, parseTaskCoordinationMetadata(r.metadataJson)] as const)
  );
  const operatorWorkload = buildOperatorWorkloadAnalytics({ tasks, metadataByTaskId });

  return { kpi, operatorWorkload, tasks, metadataByTaskId };
}

export async function buildExecutiveSimulationOverview(
  db: Db,
  input: { adminUserId: number; limit?: number }
): Promise<ExecutiveSimulationOverviewDto> {
  const engineInput = await buildSimulationEngineInput(db, input);
  const overview = buildExecutiveKpiOverviewFromEngine(engineInput.kpi);
  const velocity = buildFulfillmentVelocitySnapshot(engineInput.kpi.snapshots);
  const active = engineInput.kpi.snapshots.filter(
    (o) => o.pipelineStage !== "released" && o.pipelineStage !== "closed"
  );

  await insertExecutiveAgentAuditLog(db, {
    id: randomUUID(),
    adminUserId: input.adminUserId,
    prompt: null,
    toolName: "executive.simulation.overview",
    actionType: "simulation_overview_viewed",
    targetType: "platform",
    targetId: "simulation",
    inputJson: null,
    outputJson: JSON.stringify({ scenarios: SIMULATION_SCENARIOS.length }).slice(0, 5000),
    approvalStatus: "not_required",
  });

  return {
    ok: true,
    scenarios: SIMULATION_SCENARIOS,
    baselinePreview: {
      activeOrders: active.length,
      stalledOrders: overview.totals.stalledOrders,
      pendingApprovals: overview.totals.pendingApprovals,
      velocityScore: velocity.velocityScore,
    },
    generatedAt: new Date().toISOString(),
    meta: {
      simulationOnly: true,
      noProductionMutation: true,
      noAutonomousExecution: true,
      advisoryOnly: true,
    },
  };
}

export async function runExecutiveSimulationForAdmin(
  db: Db,
  input: {
    adminUserId: number;
    scenarioId: SimulationScenarioId;
    assumptions?: SimulationScenarioAssumptions;
    limit?: number;
    compareToBaseline?: boolean;
  }
): Promise<ExecutiveSimulationRunDto> {
  const engineInput = await buildSimulationEngineInput(db, {
    adminUserId: input.adminUserId,
    limit: input.limit,
  });

  const baseline = runExecutiveSimulation(engineInput, "baseline");
  const result = runExecutiveSimulation(
    engineInput,
    input.scenarioId,
    input.assumptions,
    input.compareToBaseline !== false && input.scenarioId !== "baseline" ? baseline : undefined
  );

  await insertExecutiveAgentAuditLog(db, {
    id: randomUUID(),
    adminUserId: input.adminUserId,
    prompt: null,
    toolName: "executive.simulation.run",
    actionType: "simulation_run",
    targetType: "platform",
    targetId: input.scenarioId,
    inputJson: JSON.stringify({
      scenarioId: input.scenarioId,
      assumptions: input.assumptions ?? {},
    }).slice(0, 50_000),
    outputJson: JSON.stringify({
      medianDays: result.timeline.medianCompletionDays,
      confidence: result.confidenceCalibration.overallConfidence,
    }).slice(0, 50_000),
    approvalStatus: "not_required",
  });

  return {
    ok: true,
    result,
    generatedAt: new Date().toISOString(),
    meta: {
      simulationOnly: true,
      noProductionMutation: true,
      noAutonomousExecution: true,
      explainable: true,
    },
  };
}

/** Skipper read bundle — non-destructive simulation context. */
export async function buildExecutiveSimulationForSkipper(
  db: Db,
  input: {
    adminUserId: number;
    scenarioId?: SimulationScenarioId;
    limit?: number;
  }
) {
  const scenarioId = input.scenarioId ?? "baseline";
  const overview = await buildExecutiveSimulationOverview(db, input);
  const run = await runExecutiveSimulationForAdmin(db, {
    adminUserId: input.adminUserId,
    scenarioId,
    limit: input.limit,
    compareToBaseline: scenarioId !== "baseline",
  });

  return {
    simulationOnly: true,
    noProductionMutation: true,
    scenarios: overview.scenarios.map((s) => ({ id: s.id, label: s.label })),
    baselinePreview: overview.baselinePreview,
    activeRun: {
      scenarioId: run.result.scenarioId,
      timeline: run.result.timeline,
      approvalDelayImpact: run.result.approvalDelayImpact,
      campaignLaunchProbability: run.result.campaignLaunchProbability,
      governanceStagnation: run.result.governanceStagnation,
      bottleneckCascade: run.result.bottleneckCascade,
      departmentLoad: run.result.departmentLoad,
      escalationImpact: run.result.escalationImpact,
      operatorRedistribution: run.result.operatorRedistribution.slice(0, 4),
      confidenceCalibration: run.result.confidenceCalibration,
      scenarioComparison: run.result.scenarioComparison.slice(0, 8),
      skipperSummary: run.result.skipperSummary,
    },
    generatedAt: run.generatedAt,
  };
}
