import { parseRevenueOsFulfillmentHandoff } from "@/lib/fulfillment/revenue-os-fulfillment-handoff";
import { detectLaunchBlockers, type LaunchReadinessInput } from "@/lib/fulfillment/revenue-os-launch-readiness";
import type { ClientFulfillmentOrderSnapshot } from "@/lib/fulfillment/fulfillment-orchestration-types";
import { FULFILLMENT_PRIMARY_SERVICE_REVENUE_OS } from "@/lib/fulfillment/fulfillment-types";

const REVENUE_OS_APPROVAL_ACTIONS = new Set([
  "createRevenueOsCampaignReviewPacket",
  "recordRevenueOsLaunchReadinessCheckpoint",
  "triggerCampaignSync",
  "triggerBentleyAnalysis",
]);

export type RevenueOsOrchestrationSignals = {
  orderId: string;
  campaignId: string | null;
  revisionRound: number;
  launchReadinessApproved: boolean;
  launchBlockers: string[];
  pendingRevenueOsApproval: boolean;
  stalledCampaignFulfillment: boolean;
};

export function isRevenueOsFulfillmentOrder(o: ClientFulfillmentOrderSnapshot): boolean {
  return o.department === FULFILLMENT_PRIMARY_SERVICE_REVENUE_OS;
}

export function buildRevenueOsOrchestrationSignals(
  order: ClientFulfillmentOrderSnapshot,
  handoffJson: string | null,
  opts?: {
    websiteOrderReleased?: boolean | null;
    proposedAction?: string | null;
  }
): RevenueOsOrchestrationSignals | null {
  if (!isRevenueOsFulfillmentOrder(order)) return null;
  const handoff = parseRevenueOsFulfillmentHandoff(handoffJson);
  const campaignId = order.campaignId ?? handoff.campaignId;
  const revisionRound = order.revisionRound ?? handoff.revisionRound;
  const launchReadinessApproved =
    order.launchReadinessApproved ?? Boolean(handoff.launchReadinessApprovedAt);

  const launchInput: LaunchReadinessInput = {
    hasCampaign: Boolean(campaignId),
    hasBentleyPayload: Boolean(campaignId),
    campaignStatus: null,
    postCounts: { draft: 0, scheduled: 0, published: 0, failed: 0 },
    ownerReviewStatus: order.ownerReviewStatus,
    pipelineStage: order.pipelineStage,
    launchReadinessApprovedAt: launchReadinessApproved ? new Date().toISOString() : handoff.launchReadinessApprovedAt,
    pendingLaunchApproval:
      order.approvalStatus === "pending" &&
      opts?.proposedAction === "recordRevenueOsLaunchReadinessCheckpoint",
    websiteOrderReleased: opts?.websiteOrderReleased ?? null,
    trustOrderAtOwnerReview: null,
  };

  const launchBlockers = detectLaunchBlockers(launchInput);
  const pendingRevenueOsApproval =
    order.approvalStatus === "pending" &&
    Boolean(opts?.proposedAction && REVENUE_OS_APPROVAL_ACTIONS.has(opts.proposedAction));

  return {
    orderId: order.orderId,
    campaignId,
    revisionRound,
    launchReadinessApproved,
    launchBlockers,
    pendingRevenueOsApproval,
    stalledCampaignFulfillment:
      order.daysInCurrentStage >= 7 &&
      order.pipelineStage !== "released" &&
      order.pipelineStage !== "closed",
  };
}

export function rankRevenueOsRecommendationPriority(input: {
  hasLaunchBlockers: boolean;
  pendingApproval: boolean;
  kpiAtRisk: boolean;
  stalled: boolean;
}): "high" | "normal" | "low" {
  if (input.pendingApproval || input.hasLaunchBlockers) return "high";
  if (input.kpiAtRisk || input.stalled) return "normal";
  return "low";
}
