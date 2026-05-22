import type {
  ApprovalChainOrchestration,
  ApprovalChainStep,
  PersistentWorkflowState,
  WorkflowEvidenceLink,
} from "@/lib/executive-agent/executive-workflow-types";

export function buildApprovalChainOrchestration(input: {
  workflow: PersistentWorkflowState;
  approvals: Array<{
    id: string;
    proposedAction: string;
    status: string;
    targetId: string | null;
  }>;
}): ApprovalChainOrchestration {
  const relevant = input.approvals.filter((a) => input.workflow.approvalIds.includes(a.id));

  const steps: ApprovalChainStep[] = relevant.map((a, i) => ({
    order: i + 1,
    approvalId: a.id,
    proposedAction: a.proposedAction,
    status: a.status,
    required: true as const,
  }));

  if (steps.length === 0 && input.workflow.currentStage === "approval_pending") {
    steps.push({
      order: 1,
      approvalId: null,
      proposedAction: null,
      status: "pending",
      required: true,
    });
  }

  const pendingCount = steps.filter((s) => s.status === "pending").length;
  const evidence: WorkflowEvidenceLink[] = [
    { source: "approvals", detail: `${steps.length} approval step(s) in chain` },
  ];

  return {
    workflowId: input.workflow.workflowId,
    steps,
    pendingCount,
    complete: steps.length > 0 && pendingCount === 0 && steps.every((s) => s.status === "executed" || s.status === "approved"),
    bypassBlocked: true,
    evidence,
  };
}

export function buildAllApprovalChains(input: {
  workflows: PersistentWorkflowState[];
  approvals: Array<{ id: string; proposedAction: string; status: string; targetId: string | null }>;
}): ApprovalChainOrchestration[] {
  return input.workflows.map((workflow) =>
    buildApprovalChainOrchestration({ workflow, approvals: input.approvals })
  );
}

/** Workflow cannot advance past approval stage without executed approval rows. */
export function isApprovalChainBlocking(workflow: PersistentWorkflowState, chain: ApprovalChainOrchestration): boolean {
  if (workflow.currentStage !== "approval_pending") return false;
  return chain.pendingCount > 0 || !chain.complete;
}
