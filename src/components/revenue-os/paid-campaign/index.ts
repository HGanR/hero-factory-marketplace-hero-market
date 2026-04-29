/**
 * Narrow client-facing surface for paid-campaign fetch JSON + hydration (Part 81).
 * Server routes should keep importing `@/lib/social/paid-campaign-api-response-types` directly.
 */
export type { PaidCampaignFetchJson, PaidCampaignListFetchJson } from "@/lib/social/paid-campaign-api-response-types";

export {
  buildPlannerPaidCampaignHydrationFromJson,
  parsePaidCampaignHydrationFromJson,
  readPromotionDecisionSummaryFromPaidJson,
} from "@/components/revenue-os/paid-campaign-hydration";
export type { PaidCampaignHydration } from "@/components/revenue-os/paid-campaign-hydration";
