import type { RevenueOsLaunchReadinessDto } from "@/lib/fulfillment/revenue-os-fulfillment-dtos";
import type { CampaignPostStatusCounts } from "@/lib/fulfillment/revenue-os-kpi-snapshot";

export type LaunchReadinessInput = {
  hasCampaign: boolean;
  hasBentleyPayload: boolean;
  campaignStatus: string | null;
  postCounts: CampaignPostStatusCounts;
  ownerReviewStatus: string | null;
  pipelineStage: string;
  launchReadinessApprovedAt: string | null;
  pendingLaunchApproval: boolean;
  websiteOrderReleased: boolean | null;
  trustOrderAtOwnerReview: boolean | null;
};

export function computeLaunchReadinessScore(blockers: string[]): number {
  const penalty = Math.min(blockers.length * 12, 72);
  return Math.max(0, 100 - penalty);
}

export function detectLaunchBlockers(input: LaunchReadinessInput): string[] {
  const blockers: string[] = [];
  if (!input.hasCampaign) blockers.push("No campaign linked to fulfillment order.");
  if (!input.hasBentleyPayload) blockers.push("Campaign missing Bentley generation payload — draft review incomplete.");
  if (input.ownerReviewStatus === "rejected") blockers.push("Deliverable owner review rejected — resolve revisions first.");
  if (input.ownerReviewStatus === "pending" && input.pipelineStage === "owner_review") {
    blockers.push("Campaign review packet pending owner review.");
  }
  if (input.postCounts.failed > 0) blockers.push("Failed posts on campaign — triage before launch readiness.");
  if (!input.launchReadinessApprovedAt && input.pendingLaunchApproval) {
    blockers.push("Launch readiness checkpoint approval still pending.");
  }
  if (input.websiteOrderReleased === false) {
    blockers.push("WEBSITE fulfillment not released — landing experience may be incomplete (dependency).");
  }
  return blockers;
}

export function detectLaunchDependencies(input: LaunchReadinessInput): string[] {
  const deps: string[] = [];
  if (input.websiteOrderReleased === false) {
    deps.push("WEBSITE: recommend site draft approved/released before paid campaign launch.");
  }
  if (input.trustOrderAtOwnerReview) {
    deps.push("TRUST: trust packet in owner review — coordinate disclaimers before heavy campaign spend.");
  }
  deps.push("Bentley sync-launch and Content360 execution remain owner-approved via existing approval queue — not autonomous.");
  return deps;
}

export function buildLaunchReadinessAssessment(
  input: LaunchReadinessInput & {
    launchApprovalId: string | null;
    launchApprovalStatus: "none" | "pending" | "approved";
  }
): RevenueOsLaunchReadinessDto {
  const blockers = detectLaunchBlockers(input);
  const dependencies = detectLaunchDependencies(input);
  const score = computeLaunchReadinessScore(blockers);
  const ready =
    blockers.length === 0 &&
    input.hasBentleyPayload &&
    Boolean(input.launchReadinessApprovedAt || input.launchApprovalStatus === "approved");
  return {
    score,
    ready,
    blockers,
    dependencies,
    approvalCheckpointStatus: input.launchApprovalStatus,
    approvalId: input.launchApprovalId,
  };
}
