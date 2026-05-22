import type {
  ExecutiveOperatorId,
  ExecutiveOperatorRecord,
} from "@/lib/executive-agent/executive-operator-types";
import {
  FULFILLMENT_PRIMARY_SERVICE_REVENUE_OS,
  FULFILLMENT_PRIMARY_SERVICE_SMART_TRUST,
  FULFILLMENT_PRIMARY_SERVICE_TRUST,
  FULFILLMENT_PRIMARY_SERVICE_WEBSITE,
} from "@/lib/fulfillment/fulfillment-types";

export const EXECUTIVE_OPERATOR_REGISTRY: ExecutiveOperatorRecord[] = [
  {
    id: "executive_owner",
    label: "Executive owner",
    department: null,
    specialization: ["approvals", "cross_department", "escalation_final"],
    canReceiveDelegation: true,
    canApproveDelegations: true,
    escalationTier: 4,
  },
  {
    id: "department_lead",
    label: "Department lead",
    department: null,
    specialization: ["desk_coordination"],
    canReceiveDelegation: true,
    canApproveDelegations: true,
    escalationTier: 3,
  },
  {
    id: "website_desk_lead",
    label: "WEBSITE desk lead",
    department: FULFILLMENT_PRIMARY_SERVICE_WEBSITE,
    specialization: ["site_builder", "owner_review", "client_delivery"],
    canReceiveDelegation: true,
    canApproveDelegations: false,
    escalationTier: 2,
  },
  {
    id: "trust_desk_lead",
    label: "TRUST desk lead",
    department: FULFILLMENT_PRIMARY_SERVICE_TRUST,
    specialization: ["trust_packet", "legal_review_intake"],
    canReceiveDelegation: true,
    canApproveDelegations: false,
    escalationTier: 2,
  },
  {
    id: "revenue_os_desk_lead",
    label: "REVENUE_OS desk lead",
    department: FULFILLMENT_PRIMARY_SERVICE_REVENUE_OS,
    specialization: ["campaign_review", "launch_readiness", "kpi_watch"],
    canReceiveDelegation: true,
    canApproveDelegations: false,
    escalationTier: 2,
  },
  {
    id: "smart_trust_desk_lead",
    label: "SMART_TRUST desk lead",
    department: FULFILLMENT_PRIMARY_SERVICE_SMART_TRUST,
    specialization: ["governance_review", "resolution_tracking", "compliance_reminders"],
    canReceiveDelegation: true,
    canApproveDelegations: false,
    escalationTier: 2,
  },
  {
    id: "fulfillment_coordinator",
    label: "Fulfillment coordinator",
    department: null,
    specialization: ["task_sequencing", "dependency_unblock"],
    canReceiveDelegation: true,
    canApproveDelegations: false,
    escalationTier: 1,
  },
  {
    id: "skipper_advisory",
    label: "Skipper (advisory)",
    department: null,
    specialization: ["recommendations", "briefing", "forecasting"],
    canReceiveDelegation: false,
    canApproveDelegations: false,
    escalationTier: 0,
  },
];

export function getExecutiveOperator(id: string): ExecutiveOperatorRecord | null {
  return EXECUTIVE_OPERATOR_REGISTRY.find((o) => o.id === id) ?? null;
}

export function isExecutiveOperatorId(id: string): id is ExecutiveOperatorId {
  return EXECUTIVE_OPERATOR_REGISTRY.some((o) => o.id === id);
}

export function resolveOperatorIdFromTask(input: {
  ownerLabel: string;
  recommendedAgent: string | null;
  department: string | null;
}): ExecutiveOperatorId {
  const agent = input.recommendedAgent?.trim().toLowerCase() ?? "";
  if (agent.includes("skipper")) return "skipper_advisory";
  if (input.department === FULFILLMENT_PRIMARY_SERVICE_WEBSITE) return "website_desk_lead";
  if (input.department === FULFILLMENT_PRIMARY_SERVICE_TRUST) return "trust_desk_lead";
  if (input.department === FULFILLMENT_PRIMARY_SERVICE_REVENUE_OS) return "revenue_os_desk_lead";
  if (input.department === FULFILLMENT_PRIMARY_SERVICE_SMART_TRUST) return "smart_trust_desk_lead";
  if (input.ownerLabel === "department_lead") return "department_lead";
  if (input.ownerLabel === "executive_owner") return "executive_owner";
  return "fulfillment_coordinator";
}

export function listOperatorsForDepartment(
  department: ExecutiveOperatorRecord["department"]
): ExecutiveOperatorRecord[] {
  return EXECUTIVE_OPERATOR_REGISTRY.filter(
    (o) => o.canReceiveDelegation && (o.department === department || o.department === null)
  );
}
