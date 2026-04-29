import type { Db } from "@/lib/db";
import {
  computePromotionDecisionSummaryForCampaign,
  listPaidSocialCampaignsByCampaign,
  projectPaidSocialCampaignsPublicForList,
  type PromotionDecisionSummary,
} from "./paid-social-campaigns";

/** Campaign-level promotion rollup; omitted when `referencedOrganicCount === 0`. Separate from `paid-social-campaigns.ts` so tests can mock list/projection imports. */
export async function buildPromotionDecisionSummaryForPaidCampaignContext(
  db: Db,
  campaignId: string
): Promise<PromotionDecisionSummary | undefined> {
  const siblingRows = await listPaidSocialCampaignsByCampaign(db, campaignId);
  const listProjected = await projectPaidSocialCampaignsPublicForList(db, siblingRows, campaignId);
  return computePromotionDecisionSummaryForCampaign(listProjected);
}
