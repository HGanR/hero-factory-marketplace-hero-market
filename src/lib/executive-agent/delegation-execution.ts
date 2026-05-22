import { DelegateOperationalTaskPayloadSchema } from "@/lib/executive-agent/executive-action-payloads";
import type { ExecutionPlan, ExecutionPlanStep } from "@/lib/executive-agent/executive-automation-types";

export function buildDelegationExecutionPlan(payloadJson: string): ExecutionPlan {
  const payload = DelegateOperationalTaskPayloadSchema.parse(JSON.parse(payloadJson));

  const steps: ExecutionPlanStep[] = [
    {
      order: 1,
      step: "Validate target operator is registered and can receive delegation",
      scope: "operator_registry",
      reversible: true,
    },
    {
      order: 2,
      step: "Verify task is active and owned by executive desk",
      scope: "operational_tasks",
      reversible: true,
    },
    {
      order: 3,
      step: "Apply approved delegation metadata with acceptance gate",
      scope: "task_coordination",
      reversible: true,
    },
    {
      order: 4,
      step: "Audit delegation execution with approval source",
      scope: "executive_audit",
      reversible: false,
    },
  ];

  return {
    workflowKind: "delegation_execution",
    proposedAction: "delegateOperationalTask",
    steps,
    department: null,
    estimatedMutations: [
      `task:${payload.taskId}:delegation_metadata`,
      `task:${payload.taskId}:owner_label`,
    ],
    advisoryOnly: false,
  };
}
