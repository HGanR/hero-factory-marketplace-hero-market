import type { SmartTrustFulfillmentHandoff } from "@/lib/fulfillment/smart-trust-fulfillment-handoff";
import {
  assessTrusteeWorkflow,
  type TrusteeWorkflowAssessment,
} from "@/lib/fulfillment/smart-trust-governance-workflow";

export type GovernanceReviewCheckpointStatus = "none" | "pending" | "approved" | "revision_requested";

export type GovernanceReviewCheckpoint = {
  status: GovernanceReviewCheckpointStatus;
  approvalId: string | null;
  round: number;
  blockers: string[];
  dependencies: string[];
  readyForOwnerReview: boolean;
};

export function detectGovernanceReviewBlockers(input: {
  handoff: SmartTrustFulfillmentHandoff;
  pipelineStage: string;
  pendingGovernanceApproval: boolean;
}): string[] {
  const blockers: string[] = [];
  if (!input.handoff.trustId) blockers.push("Trust workspace not linked on order handoff.");
  if (input.pipelineStage === "executive_handoff_received") {
    blockers.push("Order still at executive handoff — confirm intake before governance review.");
  }
  if (input.pendingGovernanceApproval) {
    blockers.push("Governance review proposal already pending owner approval.");
  }
  return blockers;
}

export function buildGovernanceReviewCheckpoint(input: {
  handoff: SmartTrustFulfillmentHandoff;
  pipelineStage: string;
  pendingGovernanceApproval: boolean;
  pendingResolutionApproval: boolean;
  governanceApprovalId: string | null;
}): GovernanceReviewCheckpoint {
  const trusteeWorkflow = assessTrusteeWorkflow({
    pipelineStage: input.pipelineStage,
    handoff: input.handoff,
    pendingGovernanceApproval: input.pendingGovernanceApproval,
    pendingResolutionApproval: input.pendingResolutionApproval,
  });
  const blockers = detectGovernanceReviewBlockers({
    handoff: input.handoff,
    pipelineStage: input.pipelineStage,
    pendingGovernanceApproval: input.pendingGovernanceApproval,
  });
  const dependencies: string[] = [];
  if (!input.handoff.governanceReviewApprovedAt) {
    dependencies.push("Prior governance review checkpoint (owner-approved internal note).");
  }
  if (input.handoff.resolutions.some((r) => r.status === "proposed")) {
    dependencies.push("Pending resolution records should complete after governance review.");
  }

  const status: GovernanceReviewCheckpointStatus = input.pendingGovernanceApproval
    ? "pending"
    : input.handoff.governanceReviewApprovedAt
      ? "approved"
      : input.handoff.governanceReviewRound > 0
        ? "revision_requested"
        : "none";

  return {
    status,
    approvalId: input.governanceApprovalId,
    round: input.handoff.governanceReviewRound,
    blockers,
    dependencies,
    readyForOwnerReview: blockers.length === 0 && !input.pendingGovernanceApproval,
  };
}

export function summarizeCheckpointForSkipper(
  checkpoint: GovernanceReviewCheckpoint,
  trusteeWorkflow: TrusteeWorkflowAssessment
): string {
  return `Governance review ${checkpoint.status}; trustee: ${trusteeWorkflow.label}; blockers: ${checkpoint.blockers.length}`;
}
