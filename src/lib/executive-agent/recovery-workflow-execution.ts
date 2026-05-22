import type { ExecutiveWriteActionName } from "@/lib/executive-agent/executive-agent-policy";
import type { ExecutionPlan, ExecutionPlanStep } from "@/lib/executive-agent/executive-automation-types";

const RECOVERY_ACTIONS = new Set<ExecutiveWriteActionName>(["createTodo", "assignFollowUp"]);

export function isRecoveryWorkflowAction(action: string): action is ExecutiveWriteActionName {
  return RECOVERY_ACTIONS.has(action as ExecutiveWriteActionName);
}

export function buildRecoveryWorkflowPlan(
  proposedAction: ExecutiveWriteActionName,
  payloadJson: string
): ExecutionPlan {
  const payload = JSON.parse(payloadJson) as Record<string, unknown>;
  const clientId = typeof payload.clientId === "string" ? payload.clientId : null;

  const steps: ExecutionPlanStep[] = [
    {
      order: 1,
      step: "Validate client scope for recovery workflow",
      scope: "crm",
      reversible: true,
    },
    {
      order: 2,
      step: "Create recovery todo or follow-up assignment",
      scope: "operational_tasks",
      reversible: false,
    },
    {
      order: 3,
      step: "Audit recovery workflow execution",
      scope: "executive_audit",
      reversible: false,
    },
  ];

  return {
    workflowKind: "recovery_workflow",
    proposedAction,
    steps,
    department: null,
    estimatedMutations: clientId ? [`client:${clientId}:recovery_action`] : ["recovery_action"],
    advisoryOnly: false,
  };
}
