import { isWriteAction, type ExecutiveWriteActionName } from "@/lib/executive-agent/executive-agent-policy";
import type {
  ApprovalSource,
  AutomationApprovalPreview,
  AutomationWorkflowKind,
  ExecutionPlan,
} from "@/lib/executive-agent/executive-automation-types";
import { validateApprovalGate, type ApprovalGateInput } from "@/lib/executive-agent/approval-gated-execution";
import { validateExecutionPolicy } from "@/lib/executive-agent/execution-policy-enforcement";
import { buildRollbackStrategy } from "@/lib/executive-agent/reversible-operational-actions";
import { buildDelegationExecutionPlan } from "@/lib/executive-agent/delegation-execution";
import { buildEscalationExecutionPlan } from "@/lib/executive-agent/escalation-execution";
import {
  buildFulfillmentTransitionPlan,
  isFulfillmentTransitionAction,
} from "@/lib/executive-agent/fulfillment-transition-execution";
import {
  buildRecoveryWorkflowPlan,
  isRecoveryWorkflowAction,
} from "@/lib/executive-agent/recovery-workflow-execution";
import {
  buildWorkloadRedistributionPlan,
  isWorkloadRedistributionPayload,
} from "@/lib/executive-agent/workload-redistribution-execution";

export type AutomationPrepareInput = {
  approvalId: string;
  proposedAction: string;
  payloadJson: string;
  targetType?: string | null;
  targetId?: string | null;
  status: ApprovalGateInput["status"];
  adminUserId: number;
  approvalOwnerAdminUserId: number;
  humanConfirmed: boolean;
  approvalSource: ApprovalSource;
};

export type AutomationPrepareResult =
  | {
      ok: true;
      preview: AutomationApprovalPreview;
    }
  | {
      ok: false;
      code: string;
      message: string;
      httpStatus: number;
      policyValidation?: ReturnType<typeof validateExecutionPolicy>;
    };

export function classifyAutomationWorkflow(
  proposedAction: string,
  payloadJson: string
): AutomationWorkflowKind {
  if (proposedAction === "delegateOperationalTask") {
    return isWorkloadRedistributionPayload(payloadJson)
      ? "workload_redistribution"
      : "delegation_execution";
  }
  if (proposedAction === "escalateOperationalTask") return "escalation_execution";
  if (isFulfillmentTransitionAction(proposedAction)) return "fulfillment_transition";
  if (isRecoveryWorkflowAction(proposedAction)) return "recovery_workflow";
  return "general_execution";
}

export function buildExecutionPlanForAction(
  proposedAction: string,
  payloadJson: string
): ExecutionPlan {
  if (proposedAction === "delegateOperationalTask") {
    if (isWorkloadRedistributionPayload(payloadJson)) {
      return buildWorkloadRedistributionPlan(payloadJson);
    }
    return buildDelegationExecutionPlan(payloadJson);
  }
  if (proposedAction === "escalateOperationalTask") {
    return buildEscalationExecutionPlan(payloadJson);
  }
  if (isWriteAction(proposedAction) && isFulfillmentTransitionAction(proposedAction)) {
    return buildFulfillmentTransitionPlan(proposedAction, payloadJson);
  }
  if (isWriteAction(proposedAction) && isRecoveryWorkflowAction(proposedAction)) {
    return buildRecoveryWorkflowPlan(proposedAction, payloadJson);
  }

  return {
    workflowKind: "general_execution",
    proposedAction,
    steps: [
      {
        order: 1,
        step: "Validate execution policy and approval gate",
        scope: "policy",
        reversible: true,
      },
      {
        order: 2,
        step: "Execute approved action via governed executor",
        scope: "executive_executor",
        reversible: false,
      },
      {
        order: 3,
        step: "Record automation audit trail",
        scope: "executive_audit",
        reversible: false,
      },
    ],
    department: null,
    estimatedMutations: [`action:${proposedAction}`],
    advisoryOnly: false,
  };
}

export function prepareGovernedAutomationExecution(input: AutomationPrepareInput): AutomationPrepareResult {
  const gate = validateApprovalGate({
    approvalId: input.approvalId,
    status: input.status,
    proposedAction: input.proposedAction,
    adminUserId: input.adminUserId,
    approvalOwnerAdminUserId: input.approvalOwnerAdminUserId,
    humanConfirmed: input.humanConfirmed,
  });

  if (!gate.ok) {
    return {
      ok: false,
      code: gate.code,
      message: gate.message,
      httpStatus: gate.httpStatus,
    };
  }

  const policyValidation = validateExecutionPolicy({
    proposedAction: input.proposedAction,
    payloadJson: input.payloadJson,
    targetType: input.targetType,
    targetId: input.targetId,
  });

  const executionPlan = buildExecutionPlanForAction(input.proposedAction, input.payloadJson);
  const rollbackStrategy = buildRollbackStrategy(input.proposedAction);

  if (!policyValidation.allowed) {
    return {
      ok: false,
      code: "POLICY_DENIED",
      message: policyValidation.violations.join("; "),
      httpStatus: 403,
      policyValidation,
    };
  }

  return {
    ok: true,
    preview: {
      approvalId: input.approvalId,
      proposedAction: input.proposedAction,
      status: input.status,
      targetType: input.targetType ?? null,
      targetId: input.targetId ?? null,
      workflowKind: executionPlan.workflowKind,
      policyValidation,
      executionPlan,
      rollbackStrategy,
    },
  };
}

export function buildAutomationMeta(policyDepartmentIsolationOk: boolean) {
  return {
    approvalGated: true as const,
    auditable: true as const,
    noAutonomousDeploy: true as const,
    noAutonomousPublish: true as const,
    noAutonomousSpend: true as const,
    noAutonomousGovernanceMutation: true as const,
    departmentIsolationPreserved: policyDepartmentIsolationOk,
  };
}

export type { ExecutiveWriteActionName };
