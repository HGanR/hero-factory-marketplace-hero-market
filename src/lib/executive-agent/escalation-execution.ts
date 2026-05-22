import { EscalateOperationalTaskPayloadSchema } from "@/lib/executive-agent/executive-action-payloads";
import type { ExecutionPlan, ExecutionPlanStep } from "@/lib/executive-agent/executive-automation-types";

export function buildEscalationExecutionPlan(payloadJson: string): ExecutionPlan {
  const payload = EscalateOperationalTaskPayloadSchema.parse(JSON.parse(payloadJson));

  const steps: ExecutionPlanStep[] = [
    {
      order: 1,
      step: "Validate escalation target against department escalation chain",
      scope: "escalation_chain",
      reversible: true,
    },
    {
      order: 2,
      step: "Verify task is active and escalation is not duplicate",
      scope: "operational_tasks",
      reversible: true,
    },
    {
      order: 3,
      step: "Apply approved escalation metadata and priority bump",
      scope: "task_coordination",
      reversible: true,
    },
    {
      order: 4,
      step: "Audit controlled escalation execution",
      scope: "executive_audit",
      reversible: false,
    },
  ];

  return {
    workflowKind: "escalation_execution",
    proposedAction: "escalateOperationalTask",
    steps,
    department: null,
    estimatedMutations: [
      `task:${payload.taskId}:escalation_metadata`,
      `task:${payload.taskId}:priority`,
    ],
    advisoryOnly: false,
  };
}
