import { randomUUID } from "crypto";
import type {
  LifecycleSupervisionRecord,
  PersistentWorkflowState,
  WorkflowEvidenceLink,
  WorkflowRecoveryOption,
} from "@/lib/executive-agent/executive-workflow-types";
import type { WorkflowContinuitySignal } from "@/lib/executive-agent/executive-workflow-types";

export function buildWorkflowRecoveryOptions(input: {
  workflow: PersistentWorkflowState;
  continuity: WorkflowContinuitySignal;
}): WorkflowRecoveryOption[] {
  const options: WorkflowRecoveryOption[] = [];

  if (input.workflow.paused) {
    options.push({
      id: randomUUID(),
      workflowId: input.workflow.workflowId,
      kind: "resume_stage",
      summary: "Resume paused workflow at last active lifecycle stage (humanConfirmed required).",
      requiresApproval: true,
      reversible: true,
      evidence: [{ source: "audit", detail: "Paused workflow recovery path" }],
    });
  }

  if (input.workflow.currentStage === "blocked") {
    options.push({
      id: randomUUID(),
      workflowId: input.workflow.workflowId,
      kind: "reopen_task",
      summary: "Review blocked tasks and dependencies — reopen or reassign via approval-gated delegation.",
      requiresApproval: true,
      reversible: true,
      evidence: [{ source: "tasks", detail: "Blocked workflow recovery" }],
    });
  }

  if (input.workflow.approvalIds.length > 0) {
    options.push({
      id: randomUUID(),
      workflowId: input.workflow.workflowId,
      kind: "rollback_approval",
      summary: "Use governed automation rollback for executed approvals when reversible.",
      requiresApproval: true,
      reversible: true,
      evidence: [{ source: "approvals", detail: "Approval rollback path via automation layer" }],
    });
  }

  if (input.continuity.risk === "broken" || input.continuity.risk === "degraded") {
    options.push({
      id: randomUUID(),
      workflowId: input.workflow.workflowId,
      kind: "audit_only",
      summary: "Mark recovery checkpoint in audit — manual desk follow-up required.",
      requiresApproval: true,
      reversible: true,
      evidence: input.continuity.evidence,
    });
  }

  return options;
}

export function buildAllWorkflowRecoveryOptions(input: {
  workflows: PersistentWorkflowState[];
  continuitySignals: WorkflowContinuitySignal[];
}): WorkflowRecoveryOption[] {
  return input.workflows.flatMap((workflow) => {
    const continuity = input.continuitySignals.find((c) => c.workflowId === workflow.workflowId)!;
    return buildWorkflowRecoveryOptions({ workflow, continuity });
  });
}

export function superviseOperationalLifecycle(input: {
  workflow: PersistentWorkflowState;
  continuity: WorkflowContinuitySignal;
}): LifecycleSupervisionRecord {
  const notes: string[] = [
    `Current stage: ${input.workflow.currentStage}`,
    `Continuity risk: ${input.continuity.risk}`,
  ];

  if (input.workflow.paused) {
    notes.push("Workflow paused — no autonomous resume.");
  }
  if (input.continuity.gaps.length > 0) {
    notes.push(...input.continuity.gaps.slice(0, 3));
  }
  notes.push("All transitions preserve approval governance and rollback controls.");

  const evidence: WorkflowEvidenceLink[] = [
    ...input.workflow.evidence,
    ...input.continuity.evidence,
  ];

  return {
    workflowId: input.workflow.workflowId,
    currentStage: input.workflow.currentStage,
    supervisionNotes: notes,
    approvalAware: true,
    rollbackAware: true,
    evidence,
  };
}

export function superviseAllLifecycles(input: {
  workflows: PersistentWorkflowState[];
  continuitySignals: WorkflowContinuitySignal[];
}): LifecycleSupervisionRecord[] {
  return input.workflows.map((workflow) => {
    const continuity = input.continuitySignals.find((c) => c.workflowId === workflow.workflowId)!;
    return superviseOperationalLifecycle({ workflow, continuity });
  });
}
