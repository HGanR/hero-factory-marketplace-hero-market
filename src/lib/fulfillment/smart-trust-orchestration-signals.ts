import { parseSmartTrustFulfillmentHandoff } from "@/lib/fulfillment/smart-trust-fulfillment-handoff";
import { buildGovernanceReviewCheckpoint } from "@/lib/fulfillment/smart-trust-review-checkpoints";
import type { ClientFulfillmentOrderSnapshot } from "@/lib/fulfillment/fulfillment-orchestration-types";
import { FULFILLMENT_PRIMARY_SERVICE_SMART_TRUST } from "@/lib/fulfillment/fulfillment-types";

const SMART_TRUST_APPROVAL_ACTIONS = new Set([
  "createSmartTrustGovernanceReviewPacket",
  "recordSmartTrustResolutionCheckpoint",
]);

export type SmartTrustOrchestrationSignals = {
  orderId: string;
  trustId: string | null;
  governanceReviewRound: number;
  governanceReviewApproved: boolean;
  governanceBlockers: string[];
  pendingSmartTrustApproval: boolean;
  stalledGovernanceFulfillment: boolean;
  openResolutionCount: number;
};

export function isSmartTrustFulfillmentOrder(o: ClientFulfillmentOrderSnapshot): boolean {
  return o.department === FULFILLMENT_PRIMARY_SERVICE_SMART_TRUST;
}

export function buildSmartTrustOrchestrationSignals(
  order: ClientFulfillmentOrderSnapshot,
  handoffJson: string | null,
  opts?: { proposedAction?: string | null }
): SmartTrustOrchestrationSignals | null {
  if (!isSmartTrustFulfillmentOrder(order)) return null;
  const handoff = parseSmartTrustFulfillmentHandoff(handoffJson);
  const trustId = order.trustId ?? handoff.trustId;
  const governanceReviewApproved =
    order.governanceReviewApproved ?? Boolean(handoff.governanceReviewApprovedAt);
  const pendingGov =
    order.approvalStatus === "pending" &&
    opts?.proposedAction === "createSmartTrustGovernanceReviewPacket";
  const pendingRes =
    order.approvalStatus === "pending" &&
    opts?.proposedAction === "recordSmartTrustResolutionCheckpoint";

  const checkpoint = buildGovernanceReviewCheckpoint({
    handoff: { ...handoff, trustId },
    pipelineStage: order.pipelineStage,
    pendingGovernanceApproval: pendingGov,
    pendingResolutionApproval: pendingRes,
    governanceApprovalId: null,
  });

  const pendingSmartTrustApproval =
    order.approvalStatus === "pending" &&
    Boolean(opts?.proposedAction && SMART_TRUST_APPROVAL_ACTIONS.has(opts.proposedAction));

  return {
    orderId: order.orderId,
    trustId,
    governanceReviewRound: order.governanceReviewRound ?? handoff.governanceReviewRound,
    governanceReviewApproved,
    governanceBlockers: checkpoint.blockers,
    pendingSmartTrustApproval,
    stalledGovernanceFulfillment:
      order.daysInCurrentStage >= 7 &&
      order.pipelineStage !== "released" &&
      order.pipelineStage !== "closed",
    openResolutionCount: handoff.resolutions.filter((r) => r.status !== "recorded").length,
  };
}

export function rankSmartTrustRecommendationPriority(input: {
  hasGovernanceBlockers: boolean;
  pendingApproval: boolean;
  complianceUrgent: boolean;
  stalled: boolean;
}): "high" | "normal" | "low" {
  if (input.pendingApproval || input.hasGovernanceBlockers) return "high";
  if (input.complianceUrgent || input.stalled) return "normal";
  return "low";
}
