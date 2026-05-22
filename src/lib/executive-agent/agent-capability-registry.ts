import type {
  AgentCapabilityRecord,
  ExecutiveDeskAgentId,
} from "@/lib/executive-agent/executive-agent-coordination-types";
import {
  FULFILLMENT_PRIMARY_SERVICE_REVENUE_OS,
  FULFILLMENT_PRIMARY_SERVICE_SMART_TRUST,
  FULFILLMENT_PRIMARY_SERVICE_TRUST,
  FULFILLMENT_PRIMARY_SERVICE_WEBSITE,
} from "@/lib/fulfillment/fulfillment-types";

export const EXECUTIVE_DESK_AGENT_IDS: ExecutiveDeskAgentId[] = [
  "skipper",
  "bentley",
  "jarva",
  "eleanor",
  "reality",
];

const DISPLAY: Record<ExecutiveDeskAgentId, { name: string; domain: string }> = {
  skipper: { name: "SKIPPER", domain: "Executive governance" },
  bentley: { name: "Bentley", domain: "Revenue OS / campaigns" },
  jarva: { name: "Jarva", domain: "Trust / Smart Trust" },
  eleanor: { name: "Eleanor", domain: "Accounting / readiness" },
  reality: { name: "Reality", domain: "Client-facing intelligence" },
};

/** Maps desk agents to governed fulfillment operators for approval-gated delegation. */
export function deskAgentToGovernedOperatorId(agentId: ExecutiveDeskAgentId): string | null {
  switch (agentId) {
    case "bentley":
      return "revenue_os_desk_lead";
    case "jarva":
      return "trust_desk_lead";
    case "eleanor":
      return "fulfillment_coordinator";
    case "reality":
      return "website_desk_lead";
    case "skipper":
      return "skipper_advisory";
  }
}

export function buildAgentCapabilityRegistry(): AgentCapabilityRecord[] {
  return EXECUTIVE_DESK_AGENT_IDS.map((agentId) => {
    const meta = DISPLAY[agentId];
    const governedOperatorId = deskAgentToGovernedOperatorId(agentId);
    const canReceive = agentId !== "skipper";

    const capabilities =
      agentId === "skipper"
        ? [
            {
              id: "governance_nexus",
              label: "Executive governance nexus",
              department: null,
              requiresApproval: true as const,
              autonomousExecution: false as const,
            },
            {
              id: "coordination_briefing",
              label: "Multi-agent coordination briefing",
              department: null,
              requiresApproval: true as const,
              autonomousExecution: false as const,
            },
          ]
        : agentId === "bentley"
          ? [
              {
                id: "campaign_review",
                label: "Campaign review intelligence",
                department: FULFILLMENT_PRIMARY_SERVICE_REVENUE_OS,
                requiresApproval: true as const,
                autonomousExecution: false as const,
              },
              {
                id: "launch_readiness",
                label: "Launch readiness advisory",
                department: FULFILLMENT_PRIMARY_SERVICE_REVENUE_OS,
                requiresApproval: true as const,
                autonomousExecution: false as const,
              },
            ]
          : agentId === "jarva"
            ? [
                {
                  id: "trust_packet",
                  label: "Trust fulfillment packet advisory",
                  department: FULFILLMENT_PRIMARY_SERVICE_TRUST,
                  requiresApproval: true as const,
                  autonomousExecution: false as const,
                },
                {
                  id: "smart_trust_governance",
                  label: "Smart Trust governance review",
                  department: FULFILLMENT_PRIMARY_SERVICE_SMART_TRUST,
                  requiresApproval: true as const,
                  autonomousExecution: false as const,
                },
              ]
            : agentId === "eleanor"
              ? [
                  {
                    id: "accounting_readiness",
                    label: "Accounting readiness review",
                    department: null,
                    requiresApproval: true as const,
                    autonomousExecution: false as const,
                  },
                  {
                    id: "dependency_unblock",
                    label: "Cross-department dependency coordination",
                    department: null,
                    requiresApproval: true as const,
                    autonomousExecution: false as const,
                  },
                ]
              : [
                  {
                    id: "client_engagement",
                    label: "Client engagement intelligence",
                    department: FULFILLMENT_PRIMARY_SERVICE_WEBSITE,
                    requiresApproval: true as const,
                    autonomousExecution: false as const,
                  },
                  {
                    id: "site_builder_intake",
                    label: "Site Builder intake coordination",
                    department: FULFILLMENT_PRIMARY_SERVICE_WEBSITE,
                    requiresApproval: true as const,
                    autonomousExecution: false as const,
                  },
                ];

    return {
      agentId,
      displayName: meta.name,
      domain: meta.domain,
      capabilities,
      governedOperatorId,
      canReceiveRoutedTasks: canReceive,
      canAutonomouslyExecute: false,
    };
  });
}

export function getAgentCapabilityRecord(agentId: ExecutiveDeskAgentId): AgentCapabilityRecord | null {
  return buildAgentCapabilityRegistry().find((a) => a.agentId === agentId) ?? null;
}

export function isExecutiveDeskAgentId(id: string): id is ExecutiveDeskAgentId {
  return (EXECUTIVE_DESK_AGENT_IDS as readonly string[]).includes(id);
}
