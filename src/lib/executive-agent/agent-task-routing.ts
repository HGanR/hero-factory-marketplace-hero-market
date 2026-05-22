import { randomUUID } from "crypto";
import type { ExecutiveOperationalTaskDto } from "@/lib/executive-agent/executive-operational-tasks";
import type {
  AgentTaskRouteRecommendation,
  CoordinationEvidenceLink,
  ExecutiveDeskAgentId,
} from "@/lib/executive-agent/executive-agent-coordination-types";
import {
  deskAgentToGovernedOperatorId,
  getAgentCapabilityRecord,
} from "@/lib/executive-agent/agent-capability-registry";
import { topSpecializedAgentForTask, scoreAgentSpecializationForTask } from "@/lib/executive-agent/agent-specialization-intelligence";

function confidenceFromScore(score: number): AgentTaskRouteRecommendation["confidence"] {
  if (score >= 75) return "high";
  if (score >= 50) return "medium";
  return "low";
}

export function buildAgentTaskRouteRecommendation(
  task: ExecutiveOperationalTaskDto,
  targetAgentId?: ExecutiveDeskAgentId
): AgentTaskRouteRecommendation {
  const scores = scoreAgentSpecializationForTask(task);
  const resolvedTarget = targetAgentId ?? topSpecializedAgentForTask(task);
  const targetScore = scores.find((s) => s.agentId === resolvedTarget)?.score ?? 40;
  const record = getAgentCapabilityRecord(resolvedTarget);
  const governedOperatorId = deskAgentToGovernedOperatorId(resolvedTarget);

  const evidence: CoordinationEvidenceLink[] = [
    { source: "tasks", detail: `Task ${task.id.slice(0, 8)}… priority=${task.priority}` },
    ...scores.filter((s) => s.agentId === resolvedTarget).flatMap((s) => s.evidence),
  ];

  const approvalAction =
    task.priority === "urgent" || task.status === "blocked"
      ? ("escalateOperationalTask" as const)
      : ("delegateOperationalTask" as const);

  return {
    id: randomUUID(),
    taskId: task.id,
    taskTitle: task.title,
    recommendedAgentId: resolvedTarget,
    confidence: confidenceFromScore(targetScore),
    confidenceScore: targetScore,
    rationale: record
      ? `Route to ${record.displayName} (${record.domain}) — specialization score ${targetScore}; approval-gated ${approvalAction}.`
      : `Route to ${resolvedTarget} with approval gate.`,
    requiresApproval: true,
    approvalAction,
    governedOperatorId: resolvedTarget === "skipper" ? null : governedOperatorId,
    evidence,
  };
}

export function buildRouteRecommendationsForTasks(
  tasks: ExecutiveOperationalTaskDto[]
): AgentTaskRouteRecommendation[] {
  const active = tasks.filter((t) => t.status !== "completed" && t.status !== "canceled");
  return active
    .filter((t) => !t.ownerLabel?.startsWith("delegated_"))
    .slice(0, 12)
    .map((t) => buildAgentTaskRouteRecommendation(t));
}
