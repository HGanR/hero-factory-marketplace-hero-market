import { parseRevenueOsFulfillmentHandoff } from "@/lib/fulfillment/revenue-os-fulfillment-handoff";
import { FULFILLMENT_PRIMARY_SERVICE_REVENUE_OS } from "@/lib/fulfillment/fulfillment-types";

export type RevenueOsIntakeReadiness = {
  tier: "ready" | "partial" | "blocked";
  score: number;
  fulfillmentReady: boolean;
  campaignLinked: boolean;
  launchReadinessApproved: boolean;
};

export function scoreRevenueOsIntakeReadiness(input: {
  executiveHandoffJson: string | null;
  salesSummaryText: string | null;
  pipelineStage: string;
}): RevenueOsIntakeReadiness {
  const handoff = parseRevenueOsFulfillmentHandoff(input.executiveHandoffJson);
  const hasCampaign = Boolean(handoff.campaignId);
  const hasSales = Boolean(input.salesSummaryText?.trim());
  let score = 40;
  if (hasCampaign) score += 35;
  if (hasSales) score += 15;
  if (handoff.intakeKind === "campaign_fulfillment") score += 10;
  if (handoff.launchReadinessApprovedAt) score += 15;

  const fulfillmentReady =
    hasCampaign &&
    (input.pipelineStage === "service_drafting" ||
      input.pipelineStage === "owner_review" ||
      input.pipelineStage === "approved_for_release" ||
      input.pipelineStage === "released");

  const tier: RevenueOsIntakeReadiness["tier"] = !hasCampaign
    ? "blocked"
    : fulfillmentReady
      ? "ready"
      : "partial";

  return {
    tier,
    score: Math.min(100, score),
    fulfillmentReady,
    campaignLinked: hasCampaign,
    launchReadinessApproved: Boolean(handoff.launchReadinessApprovedAt),
  };
}

export function loadRevenueOsIntakeFromOrder(order: {
  executiveHandoffJson: string | null;
  salesSummaryText: string | null;
  pipelineStage: string;
}): {
  readiness: RevenueOsIntakeReadiness;
  skipperSummary: string;
} {
  const handoff = parseRevenueOsFulfillmentHandoff(order.executiveHandoffJson);
  const readiness = scoreRevenueOsIntakeReadiness(order);
  const lines = [
    `[${FULFILLMENT_PRIMARY_SERVICE_REVENUE_OS} intake — ${readiness.tier.toUpperCase()} · score ${readiness.score}/100]`,
    handoff.campaignId ? `Campaign: ${handoff.campaignId}` : "Campaign: not linked on handoff",
    `Revision round: ${handoff.revisionRound}`,
    readiness.launchReadinessApproved
      ? "Launch readiness checkpoint recorded (no autonomous launch)."
      : "Launch readiness checkpoint not yet approved.",
    "Governed fulfillment only — owner approval for publish, sync-launch, and ad spend.",
  ];
  if (order.salesSummaryText?.trim()) {
    lines.push(`Sales excerpt: ${order.salesSummaryText.trim().slice(0, 280)}`);
  }
  return { readiness, skipperSummary: lines.join("\n") };
}
