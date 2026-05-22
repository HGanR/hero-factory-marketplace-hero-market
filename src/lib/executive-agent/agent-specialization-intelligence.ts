import type { ExecutiveOperationalTaskDto } from "@/lib/executive-agent/executive-operational-tasks";
import type {
  AgentSpecializationScore,
  CoordinationEvidenceLink,
  ExecutiveDeskAgentId,
} from "@/lib/executive-agent/executive-agent-coordination-types";
import {
  buildAgentCapabilityRegistry,
  EXECUTIVE_DESK_AGENT_IDS,
} from "@/lib/executive-agent/agent-capability-registry";
import {
  FULFILLMENT_PRIMARY_SERVICE_REVENUE_OS,
  FULFILLMENT_PRIMARY_SERVICE_SMART_TRUST,
  FULFILLMENT_PRIMARY_SERVICE_TRUST,
  FULFILLMENT_PRIMARY_SERVICE_WEBSITE,
} from "@/lib/fulfillment/fulfillment-types";

function departmentAgentFit(
  department: ExecutiveOperationalTaskDto["department"],
  agentId: ExecutiveDeskAgentId
): boolean {
  switch (agentId) {
    case "bentley":
      return department === FULFILLMENT_PRIMARY_SERVICE_REVENUE_OS;
    case "jarva":
      return department === FULFILLMENT_PRIMARY_SERVICE_TRUST || department === FULFILLMENT_PRIMARY_SERVICE_SMART_TRUST;
    case "reality":
      return department === FULFILLMENT_PRIMARY_SERVICE_WEBSITE;
    case "eleanor":
      return department == null;
    case "skipper":
      return true;
  }
}

export function scoreAgentSpecializationForTask(
  task: ExecutiveOperationalTaskDto
): AgentSpecializationScore[] {
  const registry = buildAgentCapabilityRegistry();
  const titleLower = task.title.toLowerCase();
  const descLower = (task.description ?? "").toLowerCase();

  return EXECUTIVE_DESK_AGENT_IDS.map((agentId) => {
    const record = registry.find((r) => r.agentId === agentId)!;
    let score = 20;
    const matched: string[] = [];
    const evidence: CoordinationEvidenceLink[] = [];

    if (departmentAgentFit(task.department, agentId)) {
      score += 35;
      matched.push("department_fit");
      evidence.push({ source: "tasks", detail: `Department ${task.department ?? "platform"} aligns with ${record.displayName}` });
    }

    for (const cap of record.capabilities) {
      const key = cap.id.replace(/_/g, " ");
      if (titleLower.includes(key.split(" ")[0]!) || descLower.includes(key.split(" ")[0]!)) {
        score += 15;
        matched.push(cap.id);
      }
    }

    if (task.recommendedAgent?.toLowerCase().includes(agentId === "jarva" ? "jarva" : agentId)) {
      score += 25;
      matched.push("recommended_agent");
      evidence.push({ source: "inference", detail: "Task recommendedAgent field matches" });
    }

    if (agentId === "skipper") score = Math.min(score, 45);

    return {
      agentId,
      score: Math.min(score, 100),
      matchedCapabilities: matched,
      departmentFit: departmentAgentFit(task.department, agentId),
      evidence,
    };
  }).sort((a, b) => b.score - a.score);
}

export function topSpecializedAgentForTask(task: ExecutiveOperationalTaskDto): ExecutiveDeskAgentId {
  const scores = scoreAgentSpecializationForTask(task);
  const executable = scores.find((s) => s.agentId !== "skipper" && s.score >= 40);
  return executable?.agentId ?? scores[0]?.agentId ?? "skipper";
}
