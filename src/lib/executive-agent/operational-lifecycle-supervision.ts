import type {
  LifecycleSupervisionRecord,
  PersistentWorkflowState,
} from "@/lib/executive-agent/executive-workflow-types";
import { superviseOperationalLifecycle } from "@/lib/executive-agent/workflow-recovery-engine";
import { monitorWorkflowContinuity } from "@/lib/executive-agent/workflow-continuity-monitor";
import { buildWorkflowDependencyGraph } from "@/lib/executive-agent/workflow-dependency-graph";
import { buildApprovalChainOrchestration } from "@/lib/executive-agent/approval-chain-orchestration";
import { buildWorkflowRecoveryOptions } from "@/lib/executive-agent/workflow-recovery-engine";
import { detectWorkflowBottlenecks } from "@/lib/executive-agent/workflow-bottleneck-intelligence";

/** Operational lifecycle supervision bundle for a single workflow. */
export function buildOperationalLifecycleSupervision(input: {
  workflow: PersistentWorkflowState;
  tasks: import("@/lib/executive-agent/executive-operational-tasks").ExecutiveOperationalTaskDto[];
  approvals: Array<{ id: string; proposedAction: string; status: string; targetId: string | null }>;
}): {
  supervision: LifecycleSupervisionRecord;
  continuity: ReturnType<typeof monitorWorkflowContinuity>;
  bottlenecks: ReturnType<typeof detectWorkflowBottlenecks>;
  recoveryOptions: ReturnType<typeof buildWorkflowRecoveryOptions>;
  dependencyGraph: ReturnType<typeof buildWorkflowDependencyGraph>;
  approvalChain: ReturnType<typeof buildApprovalChainOrchestration>;
} {
  const dependencyGraph = buildWorkflowDependencyGraph({
    workflow: input.workflow,
    tasks: input.tasks,
  });
  const continuity = monitorWorkflowContinuity({ workflow: input.workflow, dependencyGraph });
  const supervision = superviseOperationalLifecycle({ workflow: input.workflow, continuity });
  const bottlenecks = detectWorkflowBottlenecks([input.workflow]);
  const recoveryOptions = buildWorkflowRecoveryOptions({ workflow: input.workflow, continuity });
  const approvalChain = buildApprovalChainOrchestration({
    workflow: input.workflow,
    approvals: input.approvals,
  });

  return {
    supervision,
    continuity,
    bottlenecks,
    recoveryOptions,
    dependencyGraph,
    approvalChain,
  };
}

export { superviseOperationalLifecycle, superviseAllLifecycles } from "@/lib/executive-agent/workflow-recovery-engine";
