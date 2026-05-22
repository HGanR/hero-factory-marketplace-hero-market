import type { OperatorWorkloadSnapshot } from "@/lib/executive-agent/executive-operator-types";
import type {
  AgentWorkloadBalance,
  CoordinationEvidenceLink,
  ExecutiveDeskAgentId,
  PersistentAgentWorkspace,
} from "@/lib/executive-agent/executive-agent-coordination-types";
import { EXECUTIVE_DESK_AGENT_IDS } from "@/lib/executive-agent/agent-capability-registry";
import {
  FULFILLMENT_PRIMARY_SERVICE_REVENUE_OS,
  FULFILLMENT_PRIMARY_SERVICE_SMART_TRUST,
  FULFILLMENT_PRIMARY_SERVICE_TRUST,
  FULFILLMENT_PRIMARY_SERVICE_WEBSITE,
} from "@/lib/fulfillment/fulfillment-types";

function operatorLoadForAgent(
  agentId: ExecutiveDeskAgentId,
  operatorWorkload: OperatorWorkloadSnapshot[]
): OperatorWorkloadSnapshot | null {
  const map: Partial<Record<ExecutiveDeskAgentId, string>> = {
    bentley: "revenue_os_desk_lead",
    jarva: "trust_desk_lead",
    reality: "website_desk_lead",
    eleanor: "fulfillment_coordinator",
  };
  const opId = map[agentId];
  if (!opId) return null;
  return operatorWorkload.find((w) => w.operatorId === opId) ?? null;
}

export function buildAgentWorkloadBalances(input: {
  workspaces: PersistentAgentWorkspace[];
  operatorWorkload: OperatorWorkloadSnapshot[];
}): AgentWorkloadBalance[] {
  return EXECUTIVE_DESK_AGENT_IDS.map((agentId) => {
    const workspace = input.workspaces.find((w) => w.agentId === agentId);
    const opLoad = operatorLoadForAgent(agentId, input.operatorWorkload);

    const loadIndex = workspace?.loadIndex ?? opLoad?.loadIndex ?? 0;
    const openTasks = workspace?.activeTasks ?? opLoad?.openTasks ?? 0;
    const balanceLabel =
      workspace?.balanceLabel ??
      opLoad?.balanceLabel ??
      (agentId === "skipper" ? "advisory_only" : "balanced");

    const evidence: CoordinationEvidenceLink[] = [];
    if (workspace) evidence.push({ source: "tasks", detail: `Workspace load index ${workspace.loadIndex}` });
    if (opLoad) evidence.push({ source: "operators", detail: `Operator ${opLoad.operatorId} load ${opLoad.loadIndex}` });

    let rebalanceHint: string | null = null;
    if (balanceLabel === "overloaded" && agentId !== "skipper") {
      rebalanceHint = `Consider routing new tasks away from ${agentId} — overload detected; human-approved redistribution only.`;
    }

    return {
      agentId,
      loadIndex,
      openTasks,
      balanceLabel,
      rebalanceHint,
      evidence,
    };
  });
}

export function suggestRebalanceTarget(
  balances: AgentWorkloadBalance[],
  department: typeof FULFILLMENT_PRIMARY_SERVICE_WEBSITE | null
): ExecutiveDeskAgentId | null {
  const candidates = balances.filter((b) => b.agentId !== "skipper" && b.balanceLabel !== "overloaded");
  if (candidates.length === 0) return null;

  if (department === FULFILLMENT_PRIMARY_SERVICE_REVENUE_OS) {
    return candidates.find((c) => c.agentId === "bentley")?.agentId ?? null;
  }
  if (department === FULFILLMENT_PRIMARY_SERVICE_TRUST || department === FULFILLMENT_PRIMARY_SERVICE_SMART_TRUST) {
    return candidates.find((c) => c.agentId === "jarva")?.agentId ?? null;
  }
  if (department === FULFILLMENT_PRIMARY_SERVICE_WEBSITE) {
    return candidates.find((c) => c.agentId === "reality")?.agentId ?? null;
  }

  return candidates.sort((a, b) => a.loadIndex - b.loadIndex)[0]?.agentId ?? null;
}
