import { randomUUID } from "crypto";
import type { ExecutiveOperationalTaskDto } from "@/lib/executive-agent/executive-operational-tasks";
import {
  nextEscalationTarget,
  resolveEscalationChain,
} from "@/lib/executive-agent/escalation-chain-service";
import type {
  EscalationRiskAlert,
  OperatorWorkloadSnapshot,
} from "@/lib/executive-agent/executive-operator-types";
import { parseTaskCoordinationMetadata } from "@/lib/executive-agent/operator-task-metadata";
import type { WorkforceBottleneck } from "@/lib/executive-agent/workforce-bottleneck-analysis";
import type { DelegationRecommendation } from "@/lib/executive-agent/executive-operator-types";

export function buildEscalationRiskAlerts(input: {
  tasks: ExecutiveOperationalTaskDto[];
  workload: OperatorWorkloadSnapshot[];
  metadataByTaskId: Map<string, ReturnType<typeof parseTaskCoordinationMetadata>>;
}): EscalationRiskAlert[] {
  const alerts: EscalationRiskAlert[] = [];

  for (const t of input.tasks) {
    if (t.status === "completed" || t.status === "canceled") continue;
    const meta = input.metadataByTaskId.get(t.id);
    const currentLevel = meta?.escalation?.level ?? 0;
    const chain = resolveEscalationChain(t.department);
    const next = nextEscalationTarget({ department: t.department, currentLevel });

    if (t.isOverdue && next) {
      alerts.push({
        id: randomUUID(),
        taskId: t.id,
        severity: "high",
        title: `Escalation risk — overdue task`,
        rationale: `Task overdue; chain ${chain.id} suggests level ${next.level} → ${next.label}. Owner approval required.`,
        chainLevel: next.level,
        targetOperatorId: next.operatorId,
        advisoryOnly: true,
      });
    } else if (t.isBlocked && next) {
      alerts.push({
        id: randomUUID(),
        taskId: t.id,
        severity: "medium",
        title: `Stalled task may need escalation`,
        rationale: `Blocked task on ${t.department ?? "desk"} — consider escalate to ${next.label}.`,
        chainLevel: next.level,
        targetOperatorId: next.operatorId,
        advisoryOnly: true,
      });
    }

    if (meta?.escalation?.status === "proposed") {
      alerts.push({
        id: randomUUID(),
        taskId: t.id,
        severity: "medium",
        title: "Pending escalation approval",
        rationale: `Escalation to ${meta.escalation.targetOperatorId} proposed — awaiting owner approval.`,
        chainLevel: meta.escalation.level,
        targetOperatorId: meta.escalation.targetOperatorId,
        advisoryOnly: true,
      });
    }
  }

  for (const w of input.workload.filter((o) => o.balanceLabel === "overloaded" && o.overdueTasks >= 2)) {
    alerts.push({
      id: randomUUID(),
      taskId: "",
      severity: "high",
      title: `${w.label} escalation pressure`,
      rationale: `${w.overdueTasks} overdue tasks assigned — department escalation chain may be needed.`,
      chainLevel: 3,
      targetOperatorId: "executive_owner",
      advisoryOnly: true,
    });
  }

  const rank = { high: 0, medium: 1, low: 2 };
  return alerts.sort((a, b) => rank[a.severity] - rank[b.severity]).slice(0, 20);
}

export function buildExecutiveEscalationIntelligenceSummary(input: {
  workload: OperatorWorkloadSnapshot[];
  bottlenecks: WorkforceBottleneck[];
  delegationRecommendations: DelegationRecommendation[];
  escalationAlerts: EscalationRiskAlert[];
}): string {
  const overloaded = input.workload.filter((w) => w.balanceLabel === "overloaded").length;
  return [
    "Operator coordination — human-approved delegation/escalation only; no autonomous reassignment.",
    overloaded > 0 ? `${overloaded} overloaded operator role(s).` : "No overloaded operator roles.",
    input.bottlenecks.length
      ? `Workforce bottlenecks: ${input.bottlenecks.slice(0, 3).map((b) => b.title).join("; ")}.`
      : null,
    input.delegationRecommendations.length
      ? `${input.delegationRecommendations.length} delegation opportunity(ies) — owner approval required.`
      : null,
    input.escalationAlerts.length
      ? `${input.escalationAlerts.length} escalation risk alert(s).`
      : null,
  ]
    .filter(Boolean)
    .join(" ");
}
