import type { FulfillmentOrchestrationDepartment } from "@/lib/fulfillment/fulfillment-orchestration-types";
import {
  EXECUTIVE_OPERATOR_REGISTRY,
  getExecutiveOperator,
} from "@/lib/executive-agent/executive-operator-registry";
import type { ExecutiveOperatorId } from "@/lib/executive-agent/executive-operator-types";

export type EscalationChainStep = {
  level: number;
  operatorId: ExecutiveOperatorId;
  label: string;
  role: string;
};

export type EscalationChain = {
  id: string;
  department: FulfillmentOrchestrationDepartment | null;
  steps: EscalationChainStep[];
};

const CHAINS: EscalationChain[] = [
  {
    id: "website_escalation",
    department: "WEBSITE",
    steps: [
      { level: 1, operatorId: "website_desk_lead", label: "WEBSITE desk", role: "first_response" },
      { level: 2, operatorId: "department_lead", label: "Department lead", role: "coordination" },
      { level: 3, operatorId: "executive_owner", label: "Executive owner", role: "owner_decision" },
    ],
  },
  {
    id: "trust_escalation",
    department: "TRUST",
    steps: [
      { level: 1, operatorId: "trust_desk_lead", label: "TRUST desk", role: "first_response" },
      { level: 2, operatorId: "department_lead", label: "Department lead", role: "coordination" },
      { level: 3, operatorId: "executive_owner", label: "Executive owner", role: "owner_decision" },
    ],
  },
  {
    id: "revenue_os_escalation",
    department: "REVENUE_OS",
    steps: [
      { level: 1, operatorId: "revenue_os_desk_lead", label: "REVENUE_OS desk", role: "first_response" },
      { level: 2, operatorId: "department_lead", label: "Department lead", role: "coordination" },
      { level: 3, operatorId: "executive_owner", label: "Executive owner", role: "owner_decision" },
    ],
  },
  {
    id: "smart_trust_escalation",
    department: "SMART_TRUST",
    steps: [
      { level: 1, operatorId: "smart_trust_desk_lead", label: "SMART_TRUST desk", role: "governance_coordination" },
      { level: 2, operatorId: "department_lead", label: "Department lead", role: "coordination" },
      { level: 3, operatorId: "executive_owner", label: "Executive owner", role: "owner_decision" },
    ],
  },
  {
    id: "platform_escalation",
    department: null,
    steps: [
      { level: 1, operatorId: "fulfillment_coordinator", label: "Coordinator", role: "triage" },
      { level: 2, operatorId: "department_lead", label: "Department lead", role: "coordination" },
      { level: 3, operatorId: "executive_owner", label: "Executive owner", role: "final_authority" },
    ],
  },
];

export function resolveEscalationChain(
  department: FulfillmentOrchestrationDepartment | null
): EscalationChain {
  const hit =
    CHAINS.find((c) => c.department === department) ?? CHAINS.find((c) => c.id === "platform_escalation")!;
  return hit;
}

export function nextEscalationTarget(input: {
  department: FulfillmentOrchestrationDepartment | null;
  currentLevel: number;
}): EscalationChainStep | null {
  const chain = resolveEscalationChain(input.department);
  return chain.steps.find((s) => s.level === input.currentLevel + 1) ?? null;
}

export function buildApprovalDelegationChain(): Array<{
  operatorId: ExecutiveOperatorId;
  label: string;
  canApprove: boolean;
}> {
  return EXECUTIVE_OPERATOR_REGISTRY.filter((o) => o.escalationTier >= 2).map((o) => ({
    operatorId: o.id,
    label: o.label,
    canApprove: o.canApproveDelegations,
  }));
}

export function validateEscalationTarget(operatorId: string): boolean {
  const op = getExecutiveOperator(operatorId);
  return Boolean(op && op.canReceiveDelegation && op.id !== "skipper_advisory");
}
