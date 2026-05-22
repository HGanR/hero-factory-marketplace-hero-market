import type {
  ExecutiveAgentHierarchyNode,
  ExecutiveDeskAgentId,
} from "@/lib/executive-agent/executive-agent-coordination-types";
import {
  FULFILLMENT_PRIMARY_SERVICE_REVENUE_OS,
  FULFILLMENT_PRIMARY_SERVICE_SMART_TRUST,
  FULFILLMENT_PRIMARY_SERVICE_TRUST,
  FULFILLMENT_PRIMARY_SERVICE_WEBSITE,
} from "@/lib/fulfillment/fulfillment-types";

/** Skipper nexus governs desk agents — no autonomous execution below without approval. */
export function buildExecutiveAgentHierarchy(): ExecutiveAgentHierarchyNode[] {
  return [
    {
      agentId: "skipper",
      displayName: "SKIPPER",
      tier: 0,
      reportsTo: null,
      governsDepartments: [
        FULFILLMENT_PRIMARY_SERVICE_WEBSITE,
        FULFILLMENT_PRIMARY_SERVICE_TRUST,
        FULFILLMENT_PRIMARY_SERVICE_REVENUE_OS,
        FULFILLMENT_PRIMARY_SERVICE_SMART_TRUST,
      ],
      approvalAuthority: "nexus",
    },
    {
      agentId: "bentley",
      displayName: "Bentley",
      tier: 1,
      reportsTo: "skipper",
      governsDepartments: [FULFILLMENT_PRIMARY_SERVICE_REVENUE_OS],
      approvalAuthority: "desk",
    },
    {
      agentId: "jarva",
      displayName: "Jarva",
      tier: 1,
      reportsTo: "skipper",
      governsDepartments: [FULFILLMENT_PRIMARY_SERVICE_TRUST, FULFILLMENT_PRIMARY_SERVICE_SMART_TRUST],
      approvalAuthority: "desk",
    },
    {
      agentId: "reality",
      displayName: "Reality",
      tier: 1,
      reportsTo: "skipper",
      governsDepartments: [FULFILLMENT_PRIMARY_SERVICE_WEBSITE],
      approvalAuthority: "desk",
    },
    {
      agentId: "eleanor",
      displayName: "Eleanor",
      tier: 2,
      reportsTo: "skipper",
      governsDepartments: [],
      approvalAuthority: "specialist",
    },
  ];
}

export function hierarchyNodeForAgent(agentId: ExecutiveDeskAgentId): ExecutiveAgentHierarchyNode | null {
  return buildExecutiveAgentHierarchy().find((n) => n.agentId === agentId) ?? null;
}

export function canAgentEscalateTo(from: ExecutiveDeskAgentId, to: ExecutiveDeskAgentId): boolean {
  const nodes = buildExecutiveAgentHierarchy();
  const fromNode = nodes.find((n) => n.agentId === from);
  const toNode = nodes.find((n) => n.agentId === to);
  if (!fromNode || !toNode || from === to) return false;
  return toNode.tier < fromNode.tier;
}
