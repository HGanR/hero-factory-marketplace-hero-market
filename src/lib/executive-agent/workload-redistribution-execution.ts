import { DelegateOperationalTaskPayloadSchema } from "@/lib/executive-agent/executive-action-payloads";
import type { ExecutionPlan, ExecutionPlanStep } from "@/lib/executive-agent/executive-automation-types";

/** Governed workload redistribution — scoped delegation with workload rationale guardrails. */
export function buildWorkloadRedistributionPlan(payloadJson: string): ExecutionPlan {
  const payload = DelegateOperationalTaskPayloadSchema.parse(JSON.parse(payloadJson));

  const steps: ExecutionPlanStep[] = [
    {
      order: 1,
      step: "Confirm source operator overload signal (advisory workload analytics)",
      scope: "operator_workload",
      reversible: true,
    },
    {
      order: 2,
      step: "Validate target operator capacity within same department boundary",
      scope: "department_isolation",
      reversible: true,
    },
    {
      order: 3,
      step: "Apply scoped delegation for workload redistribution",
      scope: "task_coordination",
      reversible: true,
    },
    {
      order: 4,
      step: "Audit governed workload redistribution",
      scope: "executive_audit",
      reversible: false,
    },
  ];

  return {
    workflowKind: "workload_redistribution",
    proposedAction: "delegateOperationalTask",
    steps,
    department: null,
    estimatedMutations: [
      `task:${payload.taskId}:workload_redistribution`,
      `operator:${payload.targetOperatorId}:delegated_load`,
    ],
    advisoryOnly: false,
  };
}

export function isWorkloadRedistributionPayload(payloadJson: string): boolean {
  try {
    const payload = JSON.parse(payloadJson) as { rationale?: string };
    const rationale = payload.rationale?.toLowerCase() ?? "";
    return /workload|overload|redistribut|rebalance|capacity/.test(rationale);
  } catch {
    return false;
  }
}
