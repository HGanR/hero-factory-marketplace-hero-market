import { randomUUID } from "crypto";
import type {
  PersistentWorkflowState,
  WorkflowBottleneck,
  WorkflowEvidenceLink,
  WorkflowLifecycleStage,
} from "@/lib/executive-agent/executive-workflow-types";

function severityForStage(stage: WorkflowLifecycleStage, paused: boolean): WorkflowBottleneck["severity"] {
  if (paused) return "critical";
  if (stage === "blocked" || stage === "approval_pending") return "high";
  if (stage === "recovery") return "medium";
  return "watch";
}

export function detectWorkflowBottlenecks(workflows: PersistentWorkflowState[]): WorkflowBottleneck[] {
  const bottlenecks: WorkflowBottleneck[] = [];

  for (const wf of workflows) {
    if (wf.currentStage === "execution_complete") continue;

    if (wf.paused || wf.currentStage === "blocked" || wf.currentStage === "approval_pending") {
      const evidence: WorkflowEvidenceLink[] = [...wf.evidence];
      bottlenecks.push({
        id: randomUUID(),
        workflowId: wf.workflowId,
        stage: wf.currentStage,
        severity: severityForStage(wf.currentStage, wf.paused),
        summary: wf.paused
          ? `Workflow paused: ${wf.pausedRationale ?? "no rationale recorded"}`
          : `Stage ${wf.currentStage} is constraining lifecycle progress.`,
        department: wf.department,
        evidence,
      });
    }

    if (wf.continuityScore < 50) {
      bottlenecks.push({
        id: randomUUID(),
        workflowId: wf.workflowId,
        stage: wf.currentStage,
        severity: "high",
        summary: `Low continuity score (${wf.continuityScore}) — supervision recommended.`,
        department: wf.department,
        evidence: [{ source: "inference", detail: "Continuity threshold breach" }],
      });
    }
  }

  return bottlenecks.slice(0, 15);
}
