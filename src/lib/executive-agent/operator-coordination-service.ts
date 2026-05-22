import "server-only";

import { and, desc, eq } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import * as schema from "@/lib/db/schema";
import { executiveOperationalTasks } from "@/lib/db/schema";
import { buildDelegationRecommendations } from "@/lib/executive-agent/delegation-recommendation-engine";
import {
  proposeOperationalTaskDelegation,
  proposeOperationalTaskEscalation,
} from "@/lib/executive-agent/delegated-task-coordination";
import { buildExecutiveEscalationIntelligenceSummary, buildEscalationRiskAlerts } from "@/lib/executive-agent/executive-escalation-intelligence";
import { EXECUTIVE_OPERATOR_REGISTRY } from "@/lib/executive-agent/executive-operator-registry";
import { buildApprovalDelegationChain } from "@/lib/executive-agent/escalation-chain-service";
import { rowToTaskDto } from "@/lib/executive-agent/operational-task-service";
import { buildOperatorPerformanceAnalytics } from "@/lib/executive-agent/operator-performance-analytics";
import {
  buildOperatorWorkloadAnalytics,
  detectOverloadedOperators,
} from "@/lib/executive-agent/operator-workload-service";
import { parseTaskCoordinationMetadata } from "@/lib/executive-agent/operator-task-metadata";
import { detectWorkforceBottlenecks } from "@/lib/executive-agent/workforce-bottleneck-analysis";
import { insertExecutiveAgentAuditLog } from "@/lib/executive-agent/executive-agent-audit";
import { randomUUID } from "crypto";

type Db = MySql2Database<typeof schema>;

export type ExecutiveOperatorsRegistryDto = {
  ok: true;
  operators: typeof EXECUTIVE_OPERATOR_REGISTRY;
  approvalDelegationChain: ReturnType<typeof buildApprovalDelegationChain>;
  generatedAt: string;
  meta: {
    humanApprovedDelegationOnly: true;
    noAutonomousReassignment: true;
  };
};

export type ExecutiveOperatorWorkloadDto = {
  ok: true;
  workload: ReturnType<typeof buildOperatorWorkloadAnalytics>;
  overloadedOperators: ReturnType<typeof detectOverloadedOperators>;
  performance: ReturnType<typeof buildOperatorPerformanceAnalytics>;
  bottlenecks: ReturnType<typeof detectWorkforceBottlenecks>;
  delegationRecommendations: ReturnType<typeof buildDelegationRecommendations>;
  escalationAlerts: ReturnType<typeof buildEscalationRiskAlerts>;
  departmentStaffing: Array<{
    department: string | null;
    totalLoadIndex: number;
    operatorCount: number;
  }>;
  skipperSummary: string;
  generatedAt: string;
  meta: {
    advisoryOnly: true;
    noAutonomousDelegationAcceptance: true;
    noAutonomousEscalationExecution: true;
  };
};

async function loadTasksWithMetadata(db: Db, adminUserId: number, limit = 150) {
  const rows = await db
    .select()
    .from(executiveOperationalTasks)
    .where(eq(executiveOperationalTasks.adminUserId, adminUserId))
    .orderBy(desc(executiveOperationalTasks.updatedAt))
    .limit(limit);

  const tasks = rows.map(rowToTaskDto);
  const metadataByTaskId = new Map(
    rows.map((r) => [r.id, parseTaskCoordinationMetadata(r.metadataJson)] as const)
  );
  return { tasks, metadataByTaskId, rows };
}

export async function buildExecutiveOperatorsRegistry(
  _db: Db,
  _input: { adminUserId: number }
): Promise<ExecutiveOperatorsRegistryDto> {
  return {
    ok: true,
    operators: EXECUTIVE_OPERATOR_REGISTRY,
    approvalDelegationChain: buildApprovalDelegationChain(),
    generatedAt: new Date().toISOString(),
    meta: {
      humanApprovedDelegationOnly: true,
      noAutonomousReassignment: true,
    },
  };
}

export async function buildExecutiveOperatorWorkload(
  db: Db,
  input: { adminUserId: number }
): Promise<ExecutiveOperatorWorkloadDto> {
  const { tasks, metadataByTaskId } = await loadTasksWithMetadata(db, input.adminUserId);
  const workload = buildOperatorWorkloadAnalytics({ tasks, metadataByTaskId });
  const bottlenecks = detectWorkforceBottlenecks({ tasks, workload, metadataByTaskId });
  const delegationRecommendations = buildDelegationRecommendations({
    tasks,
    workload,
    metadataByTaskId,
  });
  const escalationAlerts = buildEscalationRiskAlerts({ tasks, workload, metadataByTaskId });

  const deptMap = new Map<string | null, { load: number; count: number }>();
  for (const w of workload) {
    const key = w.department;
    const hit = deptMap.get(key) ?? { load: 0, count: 0 };
    hit.load += w.loadIndex;
    hit.count += 1;
    deptMap.set(key, hit);
  }
  const departmentStaffing = [...deptMap.entries()].map(([department, v]) => ({
    department,
    totalLoadIndex: v.load,
    operatorCount: v.count,
  }));

  const skipperSummary = buildExecutiveEscalationIntelligenceSummary({
    workload,
    bottlenecks,
    delegationRecommendations,
    escalationAlerts,
  });

  await insertExecutiveAgentAuditLog(db, {
    id: randomUUID(),
    adminUserId: input.adminUserId,
    prompt: null,
    toolName: "executive.operators.workload",
    actionType: "operator_workload_viewed",
    targetType: "platform",
    targetId: "operators",
    inputJson: null,
    outputJson: JSON.stringify({ overloaded: detectOverloadedOperators(workload).length }).slice(0, 5000),
    approvalStatus: "not_required",
  });

  return {
    ok: true,
    workload,
    overloadedOperators: detectOverloadedOperators(workload),
    performance: buildOperatorPerformanceAnalytics(tasks),
    bottlenecks,
    delegationRecommendations,
    escalationAlerts,
    departmentStaffing,
    skipperSummary,
    generatedAt: new Date().toISOString(),
    meta: {
      advisoryOnly: true,
      noAutonomousDelegationAcceptance: true,
      noAutonomousEscalationExecution: true,
    },
  };
}

export async function buildExecutiveOperatorCoordinationForSkipper(
  db: Db,
  input: { adminUserId: number }
) {
  const registry = await buildExecutiveOperatorsRegistry(db, input);
  const workload = await buildExecutiveOperatorWorkload(db, input);
  const { tasks, metadataByTaskId } = await loadTasksWithMetadata(db, input.adminUserId, 80);

  const stalledDelegated = tasks.filter((t) => {
    const m = metadataByTaskId.get(t.id);
    return (
      m?.delegation?.status === "approved" &&
      !m.delegation.acceptedAt &&
      t.status !== "completed" &&
      t.status !== "canceled"
    );
  });

  return {
    recommendationOnly: true,
    humanCoordinatedOnly: true,
    registry: {
      operatorCount: registry.operators.length,
      approvalDelegationChain: registry.approvalDelegationChain,
    },
    workload: {
      overloaded: workload.overloadedOperators.slice(0, 6),
      bottlenecks: workload.bottlenecks.slice(0, 8),
      delegationRecommendations: workload.delegationRecommendations.slice(0, 8),
      escalationAlerts: workload.escalationAlerts.slice(0, 10),
      departmentStaffing: workload.departmentStaffing,
    },
    stalledDelegatedTasks: stalledDelegated.slice(0, 8).map((t) => ({
      id: t.id,
      title: t.title,
      targetOperatorId: metadataByTaskId.get(t.id)?.delegation?.targetOperatorId,
    })),
    skipperSummary: workload.skipperSummary,
    generatedAt: workload.generatedAt,
  };
}

export { proposeOperationalTaskDelegation, proposeOperationalTaskEscalation };
