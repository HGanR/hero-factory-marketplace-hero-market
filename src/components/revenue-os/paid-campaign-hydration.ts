import type { PaidCampaignHydrationJsonInput } from "@/lib/social/paid-campaign-api-response-types";
import type { PromotionDecisionSummary } from "@/lib/social/paid-social-campaigns";

/** Campaign rollup from paid-campaign API JSON; omitted `promotionDecisionSummary` key → null in UI (Part 71, 80). */
export function readPromotionDecisionSummaryFromPaidJson(
  j: PaidCampaignHydrationJsonInput
): PromotionDecisionSummary | null {
  return j.promotionDecisionSummary ?? null;
}

/**
 * Normalized client hydration after reading paid-campaign API JSON (create / PATCH / launch / sync / from-post / planner).
 * Distinct from `PaidCampaignHydrationJsonInput` (raw/partial JSON) and route success types in `paid-campaign-api-response-types`.
 */
export type PaidCampaignHydration<TPaid = unknown> = {
  paidCampaign: TPaid | null;
  promotionDecisionSummary: PromotionDecisionSummary | null;
};

export function parsePaidCampaignHydrationFromJson<TPaid>(
  j: PaidCampaignHydrationJsonInput<TPaid>
): PaidCampaignHydration<TPaid> {
  return {
    paidCampaign: j.paidCampaign ?? null,
    promotionDecisionSummary: readPromotionDecisionSummaryFromPaidJson(j),
  };
}

/** Planner bridge: same omission rules as inline `{ at, paidCampaign?, promotionDecisionSummary }` (Part 74). */
export function buildPlannerPaidCampaignHydrationFromJson<TPaid>(
  j: PaidCampaignHydrationJsonInput<TPaid>,
  at: number
): {
  at: number;
  paidCampaign?: TPaid;
  promotionDecisionSummary: PromotionDecisionSummary | null;
} {
  const h = parsePaidCampaignHydrationFromJson(j);
  return {
    at,
    ...(h.paidCampaign ? { paidCampaign: h.paidCampaign } : {}),
    promotionDecisionSummary: h.promotionDecisionSummary,
  };
}
