import { randomUUID } from "crypto";
import type {
  PersistentWorkflowState,
  WorkflowContinuitySignal,
  WorkflowEvidenceLink,
} from "@/lib/executive-agent/executive-workflow-types";
import type { WorkflowDependencyGraph } from "@/lib/executive-agent/executive-workflow-types";

function riskFromScore(score: number, paused: boolean, hasCycle: boolean): WorkflowContinuitySignal["risk"] {
  if (paused || hasCycle || score < 40) return "broken";
  if (score < 55) return "degraded";
  if (score < 75) return "watch";
  return "stable";
}

export function monitorWorkflowContinuity(input: {
  workflow: PersistentWorkflowState;
  dependencyGraph: WorkflowDependencyGraph;
}): WorkflowContinuitySignal {
  const gaps: string[] = [];
  if (input.workflow.paused) gaps.push("Workflow is paused — resume requires human action.");
  if (input.dependencyGraph.hasCycle) gaps.push("Dependency cycle detected.");
  if (input.dependencyGraph.blockedNodeIds.length > 0) {
    gaps.push(`${input.dependencyGraph.blockedNodeIds.length} blocked dependency node(s).`);
  }
  if (input.workflow.currentStage === "approval_pending" && input.workflow.approvalIds.length === 0) {
    gaps.push("Approval stage active but no approval rows linked.");
  }

  const evidence: WorkflowEvidenceLink[] = [
    { source: "audit", detail: `Continuity score ${input.workflow.continuityScore}` },
    ...input.workflow.evidence,
  ];

  return {
    workflowId: input.workflow.workflowId,
    continuityScore: input.workflow.continuityScore,
    risk: riskFromScore(
      input.workflow.continuityScore,
      input.workflow.paused,
      input.dependencyGraph.hasCycle
    ),
    gaps,
    evidence,
  };
}

export function monitorAllWorkflowContinuity(input: {
  workflows: PersistentWorkflowState[];
  dependencyGraphs: WorkflowDependencyGraph[];
}): WorkflowContinuitySignal[] {
  return input.workflows.map((workflow) => {
    const graph = input.dependencyGraphs.find((g) => g.workflowId === workflow.workflowId)!;
    return monitorWorkflowContinuity({ workflow, dependencyGraph: graph });
  });
}

export function aggregateContinuityAlertCount(signals: WorkflowContinuitySignal[]): number {
  return signals.filter((s) => s.risk === "degraded" || s.risk === "broken").length;
}

export function buildContinuityMonitorId(): string {
  return randomUUID();
}
