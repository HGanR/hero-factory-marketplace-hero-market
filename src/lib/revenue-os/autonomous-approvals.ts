import type { BentleyAutonomousCandidate } from "@/lib/revenue-os/autonomous-candidates";
import type { EvaluateBentleyAutonomousThresholdsResult } from "@/lib/revenue-os/autonomous-thresholds";

/** Serializable approval stub for dashboards and queues (no side effects). */
export type BentleyAutonomousApprovalRequest = {
  actionType: string;
  scope: string;
  reason: string;
  severity: string;
  runId?: string;
};

export function requiresBentleyApproval(evaluation: EvaluateBentleyAutonomousThresholdsResult): boolean {
  return evaluation.outcome === "require_approval";
}

export function buildApprovalRequestPayload(input: {
  candidate: BentleyAutonomousCandidate;
  evaluation: EvaluateBentleyAutonomousThresholdsResult;
}): BentleyAutonomousApprovalRequest {
  const { candidate, evaluation } = input;
  const rationale = evaluation.rationale.join(" ").trim();
  return {
    actionType: candidate.actionType,
    scope: JSON.stringify(candidate.scope ?? {}),
    reason: (rationale || candidate.reason).slice(0, 2000),
    severity: evaluation.severity,
    runId: candidate.queueId,
  };
}

export function summarizeApprovalQueue(input: {
  approvalRequests: BentleyAutonomousApprovalRequest[];
}): {
  pendingApprovalCount: number;
  summaryLine: string;
  samples: BentleyAutonomousApprovalRequest[];
} {
  const n = input.approvalRequests.length;
  const summaryLine =
    n === 0 ? "No pending autonomous approvals." : `${n} autonomous action(s) pending human approval.`;
  return {
    pendingApprovalCount: n,
    summaryLine,
    samples: input.approvalRequests.slice(0, 8),
  };
}
