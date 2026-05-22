import { randomUUID } from "crypto";
import type {
  AgentWorkloadBalance,
  CoordinationEvidenceLink,
  CrossAgentEscalationPath,
  ExecutiveDeskAgentId,
  PersistentAgentWorkspace,
} from "@/lib/executive-agent/executive-agent-coordination-types";
import { canAgentEscalateTo, buildExecutiveAgentHierarchy } from "@/lib/executive-agent/executive-agent-hierarchy";

function severityFromLoad(loadIndex: number): CrossAgentEscalationPath["severity"] {
  if (loadIndex >= 85) return "critical";
  if (loadIndex >= 70) return "high";
  if (loadIndex >= 55) return "medium";
  return "watch";
}

export function buildCrossAgentEscalationPaths(input: {
  workspaces: PersistentAgentWorkspace[];
  workloadBalances: AgentWorkloadBalance[];
}): CrossAgentEscalationPath[] {
  const paths: CrossAgentEscalationPath[] = [];
  const hierarchy = buildExecutiveAgentHierarchy();

  for (const balance of input.workloadBalances) {
    if (balance.agentId === "skipper" || balance.balanceLabel === "balanced") continue;

    const node = hierarchy.find((n) => n.agentId === balance.agentId);
    const escalateTo = node?.reportsTo ?? "skipper";
    if (!canAgentEscalateTo(balance.agentId, escalateTo)) continue;

    const evidence: CoordinationEvidenceLink[] = [
      { source: "hierarchy", detail: `${balance.agentId} reports to ${escalateTo}` },
      ...balance.evidence,
    ];

    paths.push({
      id: randomUUID(),
      fromAgentId: balance.agentId,
      toAgentId: escalateTo,
      trigger: balance.balanceLabel === "overloaded" ? "operator_overload" : "elevated_load",
      severity: severityFromLoad(balance.loadIndex),
      requiresApproval: true,
      rationale: `${balance.agentId} workload ${balance.balanceLabel} — escalate to ${escalateTo} for governed coordination (no autonomous execution).`,
      evidence,
    });
  }

  for (const ws of input.workspaces) {
    if (ws.pendingApprovals >= 3 && ws.agentId !== "skipper") {
      paths.push({
        id: randomUUID(),
        fromAgentId: ws.agentId,
        toAgentId: "skipper",
        trigger: "approval_surge",
        severity: "high",
        requiresApproval: true,
        rationale: `${ws.displayName} has ${ws.pendingApprovals} pending approval-linked items — nexus review recommended.`,
        evidence: [{ source: "audit", detail: "Approval surge detected in workspace" }],
      });
    }
  }

  return paths.slice(0, 10);
}

export function escalationPathForAgents(
  from: ExecutiveDeskAgentId,
  to: ExecutiveDeskAgentId,
  trigger: string
): CrossAgentEscalationPath | null {
  if (!canAgentEscalateTo(from, to)) return null;
  return {
    id: randomUUID(),
    fromAgentId: from,
    toAgentId: to,
    trigger,
    severity: "medium",
    requiresApproval: true,
    rationale: `Cross-agent escalation ${from} → ${to} requires human approval.`,
    evidence: [{ source: "hierarchy", detail: "Hierarchy-governed escalation path" }],
  };
}
