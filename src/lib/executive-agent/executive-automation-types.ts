import type { ExecutiveWriteActionName } from "@/lib/executive-agent/executive-agent-policy";

export type AutomationWorkflowKind =
  | "delegation_execution"
  | "escalation_execution"
  | "fulfillment_transition"
  | "recovery_workflow"
  | "workload_redistribution"
  | "general_execution";

export type ApprovalSource =
  | "executive_dashboard"
  | "automation_panel"
  | "approval_api"
  | "voice_command";

export type RollbackStrategyKind =
  | "coordination_revert"
  | "audit_mark_reversed"
  | "not_reversible";

export type ExecutionPolicyValidationResult = {
  allowed: boolean;
  violations: string[];
  preservedBoundaries: string[];
  departmentIsolationOk: boolean;
};

export type ExecutionPlanStep = {
  order: number;
  step: string;
  scope: string;
  reversible: boolean;
};

export type ExecutionPlan = {
  workflowKind: AutomationWorkflowKind;
  proposedAction: ExecutiveWriteActionName | string;
  steps: ExecutionPlanStep[];
  department: string | null;
  estimatedMutations: string[];
  advisoryOnly: false;
};

export type RollbackStrategy = {
  kind: RollbackStrategyKind;
  reversible: boolean;
  steps: string[];
  limitations: string[];
};

export type ExecutionAuditRecord = {
  auditId: string;
  approvalId: string;
  executedAt: string;
  executedByAdminUserId: number;
  proposedAction: string;
  ok: boolean;
  message: string;
};

export type AutomationExecutionResult = {
  ok: boolean;
  executionId: string;
  approvalId: string;
  executionPlan: ExecutionPlan;
  approvalSource: ApprovalSource;
  rollbackStrategy: RollbackStrategy;
  executionAudit: ExecutionAuditRecord;
  policyValidation: ExecutionPolicyValidationResult;
  executorResult?: { status: string; message: string; data?: Record<string, unknown> };
  meta: {
    approvalGated: true;
    auditable: true;
    noAutonomousDeploy: true;
    noAutonomousPublish: true;
    noAutonomousSpend: true;
    noAutonomousGovernanceMutation: true;
    departmentIsolationPreserved: boolean;
  };
};

export type AutomationRollbackResult = {
  ok: boolean;
  rollbackId: string;
  executionAuditId: string;
  rollbackStrategy: RollbackStrategy;
  message: string;
  partial: boolean;
};

export type AutomationHistoryEntry = {
  id: string;
  kind: "execution" | "rollback" | "policy_denied";
  approvalId: string | null;
  proposedAction: string | null;
  ok: boolean;
  message: string;
  approvalSource: ApprovalSource | null;
  createdAt: string;
  reversible: boolean;
};

export type AutomationHistoryDto = {
  ok: true;
  entries: AutomationHistoryEntry[];
  generatedAt: string;
};

export type AutomationApprovalPreview = {
  approvalId: string;
  proposedAction: string;
  status: string;
  targetType: string | null;
  targetId: string | null;
  workflowKind: AutomationWorkflowKind;
  policyValidation: ExecutionPolicyValidationResult;
  executionPlan: ExecutionPlan;
  rollbackStrategy: RollbackStrategy;
};
