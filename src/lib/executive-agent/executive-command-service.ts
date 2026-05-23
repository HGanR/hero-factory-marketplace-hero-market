import "server-only";

import { desc, eq } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import { randomUUID } from "crypto";
import * as schema from "@/lib/db/schema";
import {
  executiveAgentAuditLogs,
  executiveOperationalTasks,
} from "@/lib/db/schema";
import { insertExecutiveAgentAuditLog } from "@/lib/executive-agent/executive-agent-audit";
import { buildExecutiveCommandOverview } from "@/lib/executive-agent/executive-command-engine";
import type {
  ExecutiveCommandAlertsDto,
  ExecutiveCommandEngineInput,
  ExecutiveCommandIncidentsDto,
  ExecutiveCommandOverviewDto,
} from "@/lib/executive-agent/executive-command-types";
import { buildKpiEngineInput } from "@/lib/fulfillment/executive-kpi-service";
import { rowToTaskDto } from "@/lib/executive-agent/operational-task-service";
import { parseTaskCoordinationMetadata } from "@/lib/executive-agent/operator-task-metadata";
import { buildOperatorWorkloadAnalytics } from "@/lib/executive-agent/operator-workload-service";

type Db = MySql2Database<typeof schema>;

export async function buildExecutiveCommandEngineInputForAdmin(
  db: Db,
  input: { adminUserId: number; limit?: number }
): Promise<ExecutiveCommandEngineInput> {
  const limit = Math.min(Math.max(input.limit ?? 60, 1), 100);
  const kpi = await buildKpiEngineInput(db, { adminUserId: input.adminUserId, limit });

  const [auditRows, taskRows] = await Promise.all([
    db
      .select({
        actionType: executiveAgentAuditLogs.actionType,
        toolName: executiveAgentAuditLogs.toolName,
      })
      .from(executiveAgentAuditLogs)
      .where(eq(executiveAgentAuditLogs.adminUserId, input.adminUserId))
      .orderBy(desc(executiveAgentAuditLogs.createdAt))
      .limit(150),
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

  return {
    kpi,
    operatorWorkload,
    tasks,
    metadataByTaskId,
    auditActionTypes: auditRows.map((r) => r.actionType),
    auditToolNames: auditRows.map((r) => r.toolName).filter(Boolean) as string[],
  };
}

export async function buildExecutiveCommandOverviewForAdmin(
  db: Db,
  input: { adminUserId: number; limit?: number }
): Promise<ExecutiveCommandOverviewDto> {
  const engineInput = await buildExecutiveCommandEngineInputForAdmin(db, input);
  const overview = buildExecutiveCommandOverview(engineInput);

  await insertExecutiveAgentAuditLog(db, {
    id: randomUUID(),
    adminUserId: input.adminUserId,
    prompt: null,
    toolName: "executive.command.overview",
    actionType: "command_overview_viewed",
    targetType: "platform",
    targetId: "command",
    inputJson: null,
    outputJson: JSON.stringify({
      events: overview.eventStream.eventCount,
      alerts: overview.alertPrioritization.alertCount,
    }).slice(0, 5000),
    approvalStatus: "not_required",
  });

  return { ok: true, ...overview };
}

export async function buildExecutiveCommandIncidentsForAdmin(
  db: Db,
  input: { adminUserId: number; limit?: number }
): Promise<ExecutiveCommandIncidentsDto> {
  const engineInput = await buildExecutiveCommandEngineInputForAdmin(db, input);
  const overview = buildExecutiveCommandOverview(engineInput);

  await insertExecutiveAgentAuditLog(db, {
    id: randomUUID(),
    adminUserId: input.adminUserId,
    prompt: null,
    toolName: "executive.command.incidents",
    actionType: "command_incidents_viewed",
    targetType: "platform",
    targetId: "command",
    inputJson: null,
    outputJson: JSON.stringify({ count: overview.incidents.incidents.length }).slice(0, 5000),
    approvalStatus: "not_required",
  });

  return {
    ok: true,
    incidents: overview.incidents.incidents,
    topIncident: overview.incidents.topIncident,
    generatedAt: overview.generatedAt,
    meta: overview.meta,
  };
}

export async function buildExecutiveCommandAlertsForAdmin(
  db: Db,
  input: { adminUserId: number; limit?: number }
): Promise<ExecutiveCommandAlertsDto> {
  const engineInput = await buildExecutiveCommandEngineInputForAdmin(db, input);
  const overview = buildExecutiveCommandOverview(engineInput);

  await insertExecutiveAgentAuditLog(db, {
    id: randomUUID(),
    adminUserId: input.adminUserId,
    prompt: null,
    toolName: "executive.command.alerts",
    actionType: "command_alerts_viewed",
    targetType: "platform",
    targetId: "command",
    inputJson: null,
    outputJson: JSON.stringify({ count: overview.alertPrioritization.alertCount }).slice(0, 5000),
    approvalStatus: "not_required",
  });

  return {
    ok: true,
    alerts: overview.alertPrioritization.alerts,
    generatedAt: overview.generatedAt,
    meta: overview.meta,
  };
}

/** Skipper read bundle — live command intelligence without execution. */
export async function buildExecutiveCommandForSkipper(
  db: Db,
  input: { adminUserId: number; limit?: number }
) {
  const overview = await buildExecutiveCommandOverviewForAdmin(db, input);

  return {
    monitoringOnly: true,
    noAutonomousExecution: true,
    deskSnapshot: overview.deskSnapshot,
    crisisLevel: overview.crisisCoordination.crisisLevel,
    topIncident: overview.incidents.topIncident
      ? {
          title: overview.incidents.topIncident.title,
          severity: overview.incidents.topIncident.severity,
          summary: overview.incidents.topIncident.summary,
        }
      : null,
    topAlerts: overview.alertPrioritization.alerts.slice(0, 8).map((a) => ({
      rank: a.rank,
      title: a.title,
      severity: a.severity,
      routeTo: a.routeTo,
      rationale: a.rationale,
    })),
    kpiDriftScore: overview.kpiDrift.driftScore,
    escalationSurge: overview.escalationSurge.surgeDetected,
    eventCount: overview.eventStream.eventCount,
    skipperSummary: overview.skipperSummary,
    generatedAt: overview.generatedAt,
  };
}
