import "server-only";

import { desc, eq } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import { randomUUID } from "crypto";
import * as schema from "@/lib/db/schema";
import {
  executiveAgentAuditLogs,
  executiveAgentMemoryItems,
  executiveOperationalDecisions,
  executiveOperationalTasks,
} from "@/lib/db/schema";
import { insertExecutiveAgentAuditLog } from "@/lib/executive-agent/executive-agent-audit";
import {
  buildExecutiveKnowledgeGraph,
  buildExecutiveKnowledgeOverview,
} from "@/lib/executive-agent/executive-knowledge-graph";
import { buildClientRelationshipIntelligence } from "@/lib/executive-agent/client-relationship-intelligence";
import { buildExecutiveHistoricalContext } from "@/lib/executive-agent/executive-historical-context";
import { buildLifecycleIntelligence } from "@/lib/executive-agent/lifecycle-intelligence-engine";
import { buildOperatorSpecializationHistory } from "@/lib/executive-agent/operator-specialization-history";
import { buildOrganizationalPatternIntelligence } from "@/lib/executive-agent/organizational-pattern-intelligence";
import { buildInstitutionalBottleneckMemory } from "@/lib/executive-agent/institutional-bottleneck-memory";
import { buildStrategicPriorityMemory } from "@/lib/executive-agent/strategic-priority-memory";
import type {
  ExecutiveKnowledgeClientDto,
  ExecutiveKnowledgeEngineInput,
  ExecutiveKnowledgeOperatorDto,
  ExecutiveKnowledgeOverviewDto,
  StrategicMemoryItemRecord,
} from "@/lib/executive-agent/executive-knowledge-types";
import { isExecutiveOperatorId } from "@/lib/executive-agent/executive-operator-registry";
import type { ExecutiveOperatorId } from "@/lib/executive-agent/executive-operator-types";
import { rowToTaskDto } from "@/lib/executive-agent/operational-task-service";
import { parseTaskCoordinationMetadata } from "@/lib/executive-agent/operator-task-metadata";
import { buildOperatorWorkloadAnalytics } from "@/lib/executive-agent/operator-workload-service";
import { buildOperationalMemoryStore } from "@/lib/fulfillment/operational-memory-store";
import { buildKpiEngineInput } from "@/lib/fulfillment/executive-kpi-service";
import type { OperationalMemoryBuildInput } from "@/lib/fulfillment/fulfillment-operational-memory-types";

type Db = MySql2Database<typeof schema>;

async function buildKnowledgeEngineInput(
  db: Db,
  input: { adminUserId: number; limit?: number }
): Promise<ExecutiveKnowledgeEngineInput> {
  const limit = Math.min(Math.max(input.limit ?? 60, 1), 100);
  const kpi = await buildKpiEngineInput(db, { adminUserId: input.adminUserId, limit });

  const [memoryRows, auditRows, decisionRows, taskRows] = await Promise.all([
    db
      .select()
      .from(executiveAgentMemoryItems)
      .where(eq(executiveAgentMemoryItems.adminUserId, input.adminUserId))
      .orderBy(desc(executiveAgentMemoryItems.updatedAt))
      .limit(80),
    db
      .select({
        actionType: executiveAgentAuditLogs.actionType,
        toolName: executiveAgentAuditLogs.toolName,
      })
      .from(executiveAgentAuditLogs)
      .where(eq(executiveAgentAuditLogs.adminUserId, input.adminUserId))
      .orderBy(desc(executiveAgentAuditLogs.createdAt))
      .limit(120),
    db
      .select()
      .from(executiveOperationalDecisions)
      .where(eq(executiveOperationalDecisions.adminUserId, input.adminUserId))
      .orderBy(desc(executiveOperationalDecisions.updatedAt))
      .limit(80),
    db
      .select()
      .from(executiveOperationalTasks)
      .where(eq(executiveOperationalTasks.adminUserId, input.adminUserId))
      .orderBy(desc(executiveOperationalTasks.updatedAt))
      .limit(150),
  ]);

  const strategicMemoryItems: StrategicMemoryItemRecord[] = memoryRows.map((m) => ({
    id: m.id,
    memoryType: m.memoryType,
    title: m.title,
    summary: m.summary,
    subjectType: m.subjectType,
    subjectId: m.subjectId,
    confidence: Number(m.confidence ?? 0.8),
    createdAt:
      m.createdAt instanceof Date ? m.createdAt.toISOString() : String(m.createdAt ?? ""),
  }));

  const memoryBuildInput: OperationalMemoryBuildInput = {
    orders: kpi.snapshots.map((s) => ({
      orderId: s.orderId,
      clientId: s.clientId,
      department: s.department,
      pipelineStage: s.pipelineStage,
      approvalStatus: s.approvalStatus,
      ownerReviewStatus: "pending",
      clientDeliveryStatus: "not_sent",
      draftVersion: s.revisionRound ?? 1,
      daysInCurrentStage: s.daysInCurrentStage,
      paymentConsumed: s.paymentConsumed,
      updatedAt: s.updatedAt,
      createdAt: s.createdAt,
    })),
    approvals: kpi.approvalLatency.map((a) => ({
      id: `latency-${a.proposedAction}`,
      proposedAction: a.proposedAction,
      targetId: null,
      status: "executed",
      createdAt: new Date().toISOString(),
      executedAt: new Date().toISOString(),
      department: a.department,
    })),
    revisionEventCounts: new Map(),
    auditActions: auditRows.map((r) => ({
      actionType: r.actionType,
      toolName: r.toolName ?? "",
    })),
    memoryItemTitles: strategicMemoryItems.map((m) => m.title),
  };

  const operationalMemory = buildOperationalMemoryStore(memoryBuildInput);
  const tasks = taskRows.map(rowToTaskDto);
  const metadataByTaskId = new Map(
    taskRows.map((r) => [r.id, parseTaskCoordinationMetadata(r.metadataJson)] as const)
  );

  return {
    snapshots: kpi.snapshots,
    operationalMemory,
    strategicMemoryItems,
    auditActionTypes: auditRows.map((r) => r.actionType),
    auditToolNames: auditRows.map((r) => r.toolName).filter(Boolean) as string[],
    decisions: decisionRows.map((d) => ({
      id: d.id,
      title: d.title,
      status: d.status,
      priority: d.priority,
      clientId: d.clientId,
      orderId: d.orderId,
      department: d.department,
      createdAt:
        d.createdAt instanceof Date ? d.createdAt.toISOString() : String(d.createdAt ?? ""),
      decidedAt:
        d.decidedAt instanceof Date
          ? d.decidedAt.toISOString()
          : d.decidedAt
            ? String(d.decidedAt)
            : null,
    })),
    tasks,
    metadataByTaskId,
  };
}

export async function buildExecutiveKnowledgeOverviewForAdmin(
  db: Db,
  input: { adminUserId: number; limit?: number }
): Promise<ExecutiveKnowledgeOverviewDto> {
  const engineInput = await buildKnowledgeEngineInput(db, input);
  const overview = buildExecutiveKnowledgeOverview(engineInput);

  await insertExecutiveAgentAuditLog(db, {
    id: randomUUID(),
    adminUserId: input.adminUserId,
    prompt: null,
    toolName: "executive.knowledge.overview",
    actionType: "knowledge_overview_viewed",
    targetType: "platform",
    targetId: "knowledge",
    inputJson: null,
    outputJson: JSON.stringify({
      nodes: overview.graph.nodeCount,
      clients: overview.clientRelationships.clientsAnalyzed,
    }).slice(0, 5000),
    approvalStatus: "not_required",
  });

  return { ok: true, ...overview };
}

export async function buildExecutiveKnowledgeClientForAdmin(
  db: Db,
  input: { adminUserId: number; clientId: string; limit?: number }
): Promise<ExecutiveKnowledgeClientDto | { ok: false; error: string }> {
  const clientId = input.clientId.trim();
  if (!clientId) return { ok: false, error: "client_id_required" };

  const engineInput = await buildKnowledgeEngineInput(db, input);
  const clientOrders = engineInput.snapshots.filter((s) => s.clientId === clientId);
  if (clientOrders.length === 0) {
    return { ok: false, error: "client_not_in_fulfillment_scope" };
  }

  const graph = buildExecutiveKnowledgeGraph(engineInput, { clientId });
  const lifecycle = buildLifecycleIntelligence(engineInput, clientId);
  const relationships = buildClientRelationshipIntelligence(engineInput, clientId);
  const strategicPriorities = buildStrategicPriorityMemory({
    ...engineInput,
    strategicMemoryItems: engineInput.strategicMemoryItems.filter(
      (m) => m.subjectId === clientId || m.subjectType === "client"
    ),
  });
  const historicalContext = buildExecutiveHistoricalContext(engineInput, { clientId });

  const skipperSummary = [
    `Client knowledge (${clientId.slice(0, 8)}…): advisory read-only.`,
    lifecycle.trajectories[0]
      ? `Phase ${lifecycle.trajectories[0].phase}; guidance ${lifecycle.trajectories[0].guidanceScore}.`
      : "Lifecycle trajectory limited.",
    `${relationships.multiOrderClients.length} multi-order signal(s) in scope.`,
    historicalContext.historicalSummary,
  ].join(" ");

  await insertExecutiveAgentAuditLog(db, {
    id: randomUUID(),
    adminUserId: input.adminUserId,
    prompt: null,
    toolName: "executive.knowledge.client",
    actionType: "knowledge_client_viewed",
    targetType: "client",
    targetId: clientId,
    inputJson: null,
    outputJson: JSON.stringify({ orders: clientOrders.length }).slice(0, 5000),
    approvalStatus: "not_required",
  });

  return {
    ok: true,
    clientId,
    graph,
    lifecycle,
    relationships,
    strategicPriorities,
    historicalContext,
    skipperSummary,
    generatedAt: new Date().toISOString(),
    meta: {
      readOnlyIntelligence: true,
      advisoryOnly: true,
      noAutonomousStrategicChanges: true,
      noProductionMutation: true,
      explainable: true,
      evidenceLinked: true,
    },
  };
}

export async function buildExecutiveKnowledgeOperatorForAdmin(
  db: Db,
  input: { adminUserId: number; operatorId: string; limit?: number }
): Promise<ExecutiveKnowledgeOperatorDto | { ok: false; error: string }> {
  const operatorId = input.operatorId.trim() as ExecutiveOperatorId;
  if (!isExecutiveOperatorId(operatorId)) {
    return { ok: false, error: "invalid_operator_id" };
  }

  const engineInput = await buildKnowledgeEngineInput(db, input);
  const specializationHistory = buildOperatorSpecializationHistory(engineInput, operatorId);
  const workload = buildOperatorWorkloadAnalytics({
    tasks: engineInput.tasks,
    metadataByTaskId: engineInput.metadataByTaskId,
  });
  const snap = workload.find((w) => w.operatorId === operatorId);
  const workloadInsight = snap
    ? `${snap.label}: load ${snap.loadIndex} (${snap.balanceLabel}); ${snap.openTasks} open, ${snap.blockedTasks} blocked.`
    : "No workload snapshot for operator in current window.";

  const institutionalBottlenecks = buildInstitutionalBottleneckMemory(engineInput);
  const organizationalPatterns = buildOrganizationalPatternIntelligence(engineInput);

  const skipperSummary = [
    `Operator knowledge (${specializationHistory.label}): read-only advisory.`,
    specializationHistory.evolutionInsight,
    workloadInsight,
    "No autonomous delegation or restructuring.",
  ].join(" ");

  await insertExecutiveAgentAuditLog(db, {
    id: randomUUID(),
    adminUserId: input.adminUserId,
    prompt: null,
    toolName: "executive.knowledge.operator",
    actionType: "knowledge_operator_viewed",
    targetType: "operator",
    targetId: operatorId,
    inputJson: null,
    outputJson: JSON.stringify({ tasks: specializationHistory.taskHistory.length }).slice(0, 5000),
    approvalStatus: "not_required",
  });

  return {
    ok: true,
    operatorId,
    specializationHistory,
    workloadInsight,
    institutionalBottlenecks,
    organizationalPatterns,
    skipperSummary,
    generatedAt: new Date().toISOString(),
    meta: {
      readOnlyIntelligence: true,
      advisoryOnly: true,
      noAutonomousStrategicChanges: true,
      noProductionMutation: true,
      explainable: true,
      evidenceLinked: true,
    },
  };
}

/** Skipper read bundle — long-horizon knowledge context. */
export async function buildExecutiveKnowledgeForSkipper(
  db: Db,
  input: {
    adminUserId: number;
    clientId?: string | null;
    operatorId?: string | null;
    limit?: number;
  }
) {
  const overview = await buildExecutiveKnowledgeOverviewForAdmin(db, input);

  let clientBundle: ExecutiveKnowledgeClientDto | null = null;
  if (input.clientId?.trim()) {
    const c = await buildExecutiveKnowledgeClientForAdmin(db, {
      adminUserId: input.adminUserId,
      clientId: input.clientId.trim(),
      limit: input.limit,
    });
    if (c.ok) clientBundle = c;
  }

  let operatorBundle: ExecutiveKnowledgeOperatorDto | null = null;
  if (input.operatorId?.trim()) {
    const o = await buildExecutiveKnowledgeOperatorForAdmin(db, {
      adminUserId: input.adminUserId,
      operatorId: input.operatorId.trim(),
      limit: input.limit,
    });
    if (o.ok) operatorBundle = o;
  }

  return {
    readOnlyIntelligence: true,
    advisoryOnly: true,
    graphSummary: {
      nodeCount: overview.graph.nodeCount,
      edgeCount: overview.graph.edgeCount,
      confidence: overview.graph.confidence,
    },
    strategicThemes: overview.strategicMemory.themes,
    crossDepartmentClients: overview.clientRelationships.crossDepartmentClients,
    institutionalWeaknesses: overview.organizationalPatterns.institutionalWeaknesses.slice(0, 6),
    lifecycleAtRisk: overview.lifecycle.trajectories.filter((t) => t.phase === "at_risk").length,
    strategicPriorityCount: overview.strategicPriorities.activePriorityCount,
    historicalSummary: overview.historicalContext.historicalSummary,
    clientBundle: clientBundle
      ? {
          clientId: clientBundle.clientId,
          skipperSummary: clientBundle.skipperSummary,
          lifecycle: clientBundle.lifecycle.trajectories.slice(0, 3),
        }
      : null,
    operatorBundle: operatorBundle
      ? {
          operatorId: operatorBundle.operatorId,
          skipperSummary: operatorBundle.skipperSummary,
          specializationHistory: operatorBundle.specializationHistory.evolutionInsight,
        }
      : null,
    skipperSummary: overview.skipperSummary,
    generatedAt: overview.generatedAt,
  };
}
