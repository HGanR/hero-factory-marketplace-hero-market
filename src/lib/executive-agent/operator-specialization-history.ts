import {
  EXECUTIVE_OPERATOR_REGISTRY,
  resolveOperatorIdFromTask,
} from "@/lib/executive-agent/executive-operator-registry";
import type {
  ExecutiveKnowledgeEngineInput,
  KnowledgeEvidenceLink,
  OperatorSpecializationHistoryResult,
} from "@/lib/executive-agent/executive-knowledge-types";
import type { ExecutiveOperatorId } from "@/lib/executive-agent/executive-operator-types";

export function buildOperatorSpecializationHistory(
  input: ExecutiveKnowledgeEngineInput,
  operatorId: ExecutiveOperatorId
): OperatorSpecializationHistoryResult {
  const record = EXECUTIVE_OPERATOR_REGISTRY.find((o) => o.id === operatorId);
  const label = record?.label ?? operatorId;

  const taskHistory = new Map<string, number>();
  let delegationCount = 0;
  let escalationCount = 0;

  for (const task of input.tasks) {
    const meta = input.metadataByTaskId.get(task.id) ?? {};
    const assignee =
      meta.delegation?.status === "approved"
        ? meta.delegation.targetOperatorId
        : resolveOperatorIdFromTask({
            ownerLabel: task.ownerLabel,
            department: task.department,
            recommendedAgent: task.recommendedAgent,
          });
    if (assignee !== operatorId && meta.delegation?.targetOperatorId !== operatorId) continue;

    const key = task.department ?? task.recommendedAgent ?? "general";
    taskHistory.set(key, (taskHistory.get(key) ?? 0) + 1);
    if (meta.delegation?.targetOperatorId === operatorId) delegationCount += 1;
    if (meta.escalation?.targetOperatorId === operatorId) escalationCount += 1;
  }

  for (const pattern of input.operationalMemory.operatorPatterns) {
    if (pattern.label.toLowerCase().includes(operatorId.replace(/_/g, " "))) {
      taskHistory.set(pattern.actionKey, pattern.occurrenceCount);
    }
  }

  const specializations = record?.specialization ?? [];
  const totalTasks = [...taskHistory.values()].reduce((a, b) => a + b, 0);
  const evolutionInsight =
    totalTasks >= 5
      ? `${label} shows sustained ${specializations.join(", ") || "desk"} specialization across ${totalTasks} coordinated tasks.`
      : totalTasks >= 1
        ? `${label} has emerging task history — specialization profile forming.`
        : `${label} registry specialization: ${specializations.join(", ") || "general"} — limited task history in window.`;

  const evidence: KnowledgeEvidenceLink[] = [
    { source: "tasks", detail: `${totalTasks} task signals for ${operatorId}` },
    { source: "operational_memory", detail: "Operator priority patterns from operational memory" },
  ];

  return {
    operatorId,
    label,
    specializations,
    taskHistory: [...taskHistory.entries()].map(([taskType, count]) => ({ taskType, count })),
    delegationCount,
    escalationCount,
    evolutionInsight,
    confidence: totalTasks >= 4 ? "high" : totalTasks >= 1 ? "medium" : "low",
    evidence,
    advisoryOnly: true,
  };
}
