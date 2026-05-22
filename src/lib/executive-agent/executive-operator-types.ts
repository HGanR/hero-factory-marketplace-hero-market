import type { FulfillmentOrchestrationDepartment } from "@/lib/fulfillment/fulfillment-orchestration-types";

export type ExecutiveOperatorId =
  | "executive_owner"
  | "department_lead"
  | "website_desk_lead"
  | "trust_desk_lead"
  | "revenue_os_desk_lead"
  | "smart_trust_desk_lead"
  | "skipper_advisory"
  | "fulfillment_coordinator";

export type ExecutiveOperatorRecord = {
  id: ExecutiveOperatorId;
  label: string;
  department: FulfillmentOrchestrationDepartment | null;
  specialization: string[];
  canReceiveDelegation: boolean;
  canApproveDelegations: boolean;
  escalationTier: number;
};

export type TaskDelegationMetadata = {
  status: "proposed" | "approved" | "revoked";
  targetOperatorId: ExecutiveOperatorId;
  proposedByAdminUserId: number;
  proposedAt: string;
  approvedAt: string | null;
  approvalId: string | null;
  rationale: string;
  /** Operator must explicitly accept via owner action — never autonomous. */
  acceptanceRequired: true;
  acceptedAt: string | null;
};

export type TaskEscalationMetadata = {
  status: "proposed" | "approved" | "revoked";
  chainId: string;
  level: number;
  targetOperatorId: ExecutiveOperatorId;
  proposedAt: string;
  approvedAt: string | null;
  approvalId: string | null;
  rationale: string;
  priority: "normal" | "high" | "urgent";
};

export type TaskCoordinationMetadata = {
  delegation?: TaskDelegationMetadata;
  escalation?: TaskEscalationMetadata;
  lastCoordinationAction?: "delegate" | "escalate" | null;
};

export type OperatorWorkloadSnapshot = {
  operatorId: ExecutiveOperatorId;
  label: string;
  department: FulfillmentOrchestrationDepartment | null;
  openTasks: number;
  inProgressTasks: number;
  blockedTasks: number;
  overdueTasks: number;
  delegatedPendingAcceptance: number;
  loadIndex: number;
  balanceLabel: "underloaded" | "balanced" | "elevated" | "overloaded";
};

export type DelegationRecommendation = {
  id: string;
  taskId: string;
  fromOperatorId: ExecutiveOperatorId;
  toOperatorId: ExecutiveOperatorId;
  title: string;
  rationale: string;
  confidence: "low" | "medium" | "high";
  advisoryOnly: true;
};

export type EscalationRiskAlert = {
  id: string;
  taskId: string;
  severity: "low" | "medium" | "high";
  title: string;
  rationale: string;
  chainLevel: number;
  targetOperatorId: ExecutiveOperatorId;
  advisoryOnly: true;
};
