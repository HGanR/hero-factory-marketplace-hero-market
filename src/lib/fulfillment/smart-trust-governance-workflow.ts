import type { SmartTrustFulfillmentHandoff } from "@/lib/fulfillment/smart-trust-fulfillment-handoff";

/** Trustee operational workflow states — advisory labels only; no autonomous transitions. */
export const SMART_TRUST_TRUSTEE_WORKFLOW_STATES = [
  "intake_received",
  "governance_review_pending",
  "trustee_coordination",
  "resolution_tracking",
  "amendment_review",
  "owner_signoff_queue",
  "governance_closed",
] as const;

export type SmartTrustTrusteeWorkflowState = (typeof SMART_TRUST_TRUSTEE_WORKFLOW_STATES)[number];

export const SMART_TRUST_GOVERNANCE_DISCLAIMER =
  "Governed Smart Trust operations are advisory only. No autonomous trust execution, legal automation, amendment application, filing, or signatures. Human counsel and owner review required.";

export type TrusteeWorkflowAssessment = {
  state: SmartTrustTrusteeWorkflowState;
  label: string;
  summary: string;
  unresolvedGovernanceActions: string[];
};

export function inferTrusteeWorkflowState(input: {
  pipelineStage: string;
  handoff: SmartTrustFulfillmentHandoff;
  pendingGovernanceApproval: boolean;
  pendingResolutionApproval: boolean;
}): SmartTrustTrusteeWorkflowState {
  if (input.pipelineStage === "closed" || input.pipelineStage === "released") {
    return "governance_closed";
  }
  if (input.pendingResolutionApproval) return "resolution_tracking";
  if (input.pendingGovernanceApproval) return "governance_review_pending";
  if (!input.handoff.governanceReviewApprovedAt) return "governance_review_pending";
  if (input.handoff.amendmentReviewRound > 0) return "amendment_review";
  if (input.handoff.resolutions.some((r) => r.status !== "recorded")) return "resolution_tracking";
  if (input.pipelineStage === "owner_review") return "owner_signoff_queue";
  if (input.pipelineStage === "service_drafting") return "trustee_coordination";
  return "intake_received";
}

export function assessTrusteeWorkflow(input: {
  pipelineStage: string;
  handoff: SmartTrustFulfillmentHandoff;
  pendingGovernanceApproval: boolean;
  pendingResolutionApproval: boolean;
}): TrusteeWorkflowAssessment {
  const state = inferTrusteeWorkflowState(input);
  const unresolved: string[] = [];
  if (!input.handoff.trustId) unresolved.push("Link trust workspace to fulfillment order handoff.");
  if (!input.handoff.governanceReviewApprovedAt && !input.pendingGovernanceApproval) {
    unresolved.push("Propose governance review checkpoint for owner approval.");
  }
  if (input.pendingGovernanceApproval) {
    unresolved.push("Governance review approval pending in executive queue.");
  }
  if (input.pendingResolutionApproval) {
    unresolved.push("Resolution/minutes record approval pending.");
  }
  const openResolutions = input.handoff.resolutions.filter((r) => r.status !== "recorded");
  if (openResolutions.length) {
    unresolved.push(`${openResolutions.length} resolution(s) not yet recorded via governed checkpoint.`);
  }

  const labels: Record<SmartTrustTrusteeWorkflowState, string> = {
    intake_received: "Intake received",
    governance_review_pending: "Governance review pending",
    trustee_coordination: "Trustee coordination",
    resolution_tracking: "Resolution / minutes tracking",
    amendment_review: "Amendment review",
    owner_signoff_queue: "Owner sign-off queue",
    governance_closed: "Governance closed",
  };

  return {
    state,
    label: labels[state],
    summary: `Trustee workflow: ${labels[state]} — ${unresolved.length ? unresolved[0] : "no blocking governance actions flagged."}`,
    unresolvedGovernanceActions: unresolved,
  };
}

export function buildGovernanceReviewPacketMarkdown(input: {
  orderId: string;
  clientId: string;
  trustId: string | null;
  governanceReviewRound: number;
  trusteeWorkflow: TrusteeWorkflowAssessment;
  salesSummaryExcerpt: string | null;
}): string {
  const lines = [
    "# Smart Trust governance review packet",
    "",
    SMART_TRUST_GOVERNANCE_DISCLAIMER,
    "",
    `Order: ${input.orderId}`,
    `Client: ${input.clientId}`,
    `Trust workspace: ${input.trustId ?? "(not linked)"}`,
    `Governance review round: ${input.governanceReviewRound}`,
    `Trustee workflow: ${input.trusteeWorkflow.label}`,
    "",
    "## Workflow summary",
    input.trusteeWorkflow.summary,
    "",
    "## Unresolved governance actions",
    ...(input.trusteeWorkflow.unresolvedGovernanceActions.length
      ? input.trusteeWorkflow.unresolvedGovernanceActions.map((u) => `- ${u}`)
      : ["- None flagged"]),
    "",
    "## Sales / intake excerpt",
    input.salesSummaryExcerpt?.trim() || "(none)",
    "",
    "## Owner checkpoint",
    "Approve to record internal governance note only. Does not apply amendments, file documents, or execute trust changes.",
  ];
  return lines.join("\n").slice(0, 100_000);
}
