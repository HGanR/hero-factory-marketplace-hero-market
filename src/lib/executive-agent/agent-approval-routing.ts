import { randomUUID } from "crypto";
import type {
  AgentApprovalRoute,
  AgentTaskRouteRecommendation,
  ExecutiveDeskAgentId,
} from "@/lib/executive-agent/executive-agent-coordination-types";
import { getAgentCapabilityRecord } from "@/lib/executive-agent/agent-capability-registry";
import { hierarchyNodeForAgent } from "@/lib/executive-agent/executive-agent-hierarchy";

const POLICY_CHECKS = [
  "approval_required",
  "no_autonomous_execution",
  "department_isolation",
  "audit_logging",
  "rollback_available",
  "execution_policy_enforced",
] as const;

export function buildAgentApprovalRoute(
  recommendation: AgentTaskRouteRecommendation
): AgentApprovalRoute {
  const record = getAgentCapabilityRecord(recommendation.recommendedAgentId);
  const hierarchy = hierarchyNodeForAgent(recommendation.recommendedAgentId);

  const policyChecks = [...POLICY_CHECKS];
  if (recommendation.recommendedAgentId === "skipper") {
    policyChecks.push("skipper_advisory_only");
  }
  if (hierarchy?.approvalAuthority === "desk") {
    policyChecks.push("desk_approval_chain");
  }

  return {
    routingId: randomUUID(),
    taskId: recommendation.taskId,
    targetAgentId: recommendation.recommendedAgentId,
    approvalRequired: true,
    proposedAction: recommendation.approvalAction,
    governedOperatorId: recommendation.governedOperatorId,
    policyChecks,
    rollbackAvailable: true,
  };
}

export function validateAgentApprovalRouting(input: {
  targetAgentId: ExecutiveDeskAgentId;
  humanConfirmed?: boolean;
}): { allowed: boolean; violations: string[] } {
  const violations: string[] = [];
  const record = getAgentCapabilityRecord(input.targetAgentId);

  if (!record) {
    violations.push("Unknown desk agent.");
    return { allowed: false, violations };
  }

  if (!record.canReceiveRoutedTasks) {
    violations.push(`${record.displayName} is advisory-only — cannot receive routed operational tasks without desk handoff.`);
  }

  if (!input.humanConfirmed) {
    violations.push("Human confirmation required before approval proposal.");
  }

  return { allowed: violations.length === 0, violations };
}
