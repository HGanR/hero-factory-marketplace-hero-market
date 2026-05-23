import type { ExecutiveOperationalTaskDto } from "@/lib/executive-agent/executive-operational-tasks";
import type { ExecutiveOperationalThreadDto } from "@/lib/executive-agent/executive-conversation-threads";
import type {
  CoordinationEvidenceLink,
  ExecutiveDeskAgentId,
  PersistentAgentWorkspace,
} from "@/lib/executive-agent/executive-agent-coordination-types";
import {
  buildAgentCapabilityRegistry,
  deskAgentToGovernedOperatorId,
} from "@/lib/executive-agent/agent-capability-registry";
import {
  FULFILLMENT_PRIMARY_SERVICE_REVENUE_OS,
  FULFILLMENT_PRIMARY_SERVICE_SMART_TRUST,
  FULFILLMENT_PRIMARY_SERVICE_TRUST,
  FULFILLMENT_PRIMARY_SERVICE_WEBSITE,
} from "@/lib/fulfillment/fulfillment-types";

const SUBJECT_BY_AGENT: Record<ExecutiveDeskAgentId, string[]> = {
  skipper: ["command_center", "tasks", "troo_town", "site_builder"],
  bentley: ["revenue_os", "analytics"],
  jarva: ["trust_jarva", "smart_trust"],
  eleanor: ["ai_agents", "crm_intelligence"],
  reality: ["ai_agents", "inbox", "crm_intelligence"],
};

function resolveAgentForTask(task: ExecutiveOperationalTaskDto): ExecutiveDeskAgentId {
  const agent = task.recommendedAgent?.toLowerCase() ?? "";
  if (agent.includes("bentley")) return "bentley";
  if (agent.includes("jarva") || agent.includes("trust")) return "jarva";
  if (agent.includes("eleanor")) return "eleanor";
  if (agent.includes("reality")) return "reality";
  if (agent.includes("skipper")) return "skipper";

  switch (task.department) {
    case FULFILLMENT_PRIMARY_SERVICE_REVENUE_OS:
      return "bentley";
    case FULFILLMENT_PRIMARY_SERVICE_TRUST:
    case FULFILLMENT_PRIMARY_SERVICE_SMART_TRUST:
      return "jarva";
    case FULFILLMENT_PRIMARY_SERVICE_WEBSITE:
      return "reality";
    default:
      return "skipper";
  }
}

function resolveAgentForThread(thread: ExecutiveOperationalThreadDto): ExecutiveDeskAgentId {
  if (thread.subjectId === "troo_town") return "skipper";
  if (thread.subjectId === "revenue_os") return "bentley";
  if (thread.subjectId === "trust_jarva" || thread.subjectId === "smart_trust") return "jarva";
  if (thread.department === FULFILLMENT_PRIMARY_SERVICE_REVENUE_OS) return "bentley";
  if (
    thread.department === FULFILLMENT_PRIMARY_SERVICE_TRUST ||
    thread.department === FULFILLMENT_PRIMARY_SERVICE_SMART_TRUST
  )
    return "jarva";
  if (thread.department === FULFILLMENT_PRIMARY_SERVICE_WEBSITE) return "reality";
  return "skipper";
}

function balanceLabel(loadIndex: number, advisoryOnly: boolean): PersistentAgentWorkspace["balanceLabel"] {
  if (advisoryOnly) return "advisory_only";
  if (loadIndex >= 75) return "overloaded";
  if (loadIndex >= 50) return "elevated";
  return "balanced";
}

export function buildPersistentAgentWorkspaces(input: {
  tasks: ExecutiveOperationalTaskDto[];
  threads: ExecutiveOperationalThreadDto[];
  pendingApprovalCount: number;
}): PersistentAgentWorkspace[] {
  const registry = buildAgentCapabilityRegistry();

  return registry.map((agent) => {
    const agentTasks = input.tasks.filter(
      (t) => resolveAgentForTask(t) === agent.agentId && t.status !== "completed" && t.status !== "canceled"
    );
    const agentThreads = input.threads.filter(
      (t) => resolveAgentForThread(t) === agent.agentId && t.status !== "archived" && t.status !== "resolved"
    );
    const pendingForAgent = input.tasks.filter(
      (t) => resolveAgentForTask(t) === agent.agentId && t.approvalId && t.status === "blocked"
    ).length;

    const openTasks = agentTasks.length;
    const openThreads = agentThreads.length;
    const loadIndex = agent.agentId === "skipper"
      ? Math.min(40 + openThreads * 3, 100)
      : Math.min(openTasks * 12 + openThreads * 5 + pendingForAgent * 8, 100);

    const evidence: CoordinationEvidenceLink[] = [
      { source: "tasks", detail: `${openTasks} active task(s) mapped to ${agent.displayName}` },
      { source: "threads", detail: `${openThreads} open thread(s) in workspace` },
    ];
    if (agent.governedOperatorId) {
      evidence.push({
        source: "operators",
        detail: `Governed operator bridge: ${deskAgentToGovernedOperatorId(agent.agentId)}`,
      });
    }

    const lastActivity = [...agentTasks, ...agentThreads]
      .map((x) => ("updatedAt" in x ? x.updatedAt : x.lastMessageAt))
      .filter(Boolean)
      .sort()
      .pop() ?? null;

    return {
      agentId: agent.agentId,
      displayName: agent.displayName,
      subjectIds: SUBJECT_BY_AGENT[agent.agentId],
      activeTasks: openTasks,
      openThreads,
      pendingApprovals: agent.agentId === "skipper" ? input.pendingApprovalCount : pendingForAgent,
      loadIndex,
      balanceLabel: balanceLabel(loadIndex, agent.agentId === "skipper"),
      lastActivityAt: lastActivity,
      evidence,
    };
  });
}

export { resolveAgentForTask, resolveAgentForThread };
