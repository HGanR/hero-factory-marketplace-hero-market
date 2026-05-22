import type {
  LifecycleSupervisionRecord,
  PersistentWorkflowState,
  WorkflowLifecycleStage,
  WorkflowStageRecord,
} from "@/lib/executive-agent/executive-workflow-types";

const STAGE_TRANSITIONS: Record<WorkflowLifecycleStage, WorkflowLifecycleStage[]> = {
  intake: ["coordination", "paused"],
  coordination: ["approval_pending", "blocked", "paused"],
  approval_pending: ["approved_execution", "blocked", "paused"],
  approved_execution: ["execution_complete", "recovery", "blocked", "paused"],
  execution_complete: ["recovery"],
  recovery: ["coordination", "paused"],
  paused: ["coordination", "intake"],
  blocked: ["coordination", "recovery", "paused"],
};

export function allowedLifecycleTransitions(from: WorkflowLifecycleStage): WorkflowLifecycleStage[] {
  return STAGE_TRANSITIONS[from] ?? [];
}

export function orchestrateLifecycleStages(workflow: PersistentWorkflowState): WorkflowStageRecord[] {
  return workflow.stages.map((stage) => {
    const canTransition = allowedLifecycleTransitions(workflow.currentStage).includes(stage.stage);
    return {
      ...stage,
      reversible: stage.reversible && workflow.currentStage !== "execution_complete",
      evidence: [
        ...stage.evidence,
        {
          source: "inference" as const,
          detail: canTransition
            ? `Transition to ${stage.stage} allowed with approval`
            : `Transition to ${stage.stage} gated`,
        },
      ],
    };
  });
}

export function nextLifecycleStage(workflow: PersistentWorkflowState): WorkflowLifecycleStage | null {
  const allowed = allowedLifecycleTransitions(workflow.currentStage);
  return allowed.find((s) => s !== "paused" && s !== "blocked") ?? null;
}

export function orchestrateMultiStageLifecycle(workflows: PersistentWorkflowState[]): Array<{
  workflowId: string;
  stages: WorkflowStageRecord[];
  nextStage: WorkflowLifecycleStage | null;
}> {
  return workflows.map((workflow) => ({
    workflowId: workflow.workflowId,
    stages: orchestrateLifecycleStages(workflow),
    nextStage: nextLifecycleStage(workflow),
  }));
}
