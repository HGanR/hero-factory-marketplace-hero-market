import { and, eq } from "drizzle-orm";
import { campaignReviewerAssignments, campaigns, type CampaignRow } from "@/lib/db/schema";
import type { CampaignReviewerRole } from "@/lib/revenue-os/campaign-reviewer-role";
import { normalizeReviewerRole } from "@/lib/revenue-os/campaign-reviewer-role";

export type CampaignReviewerAccess = {
  campaign: CampaignRow;
  reviewerRole: CampaignReviewerRole;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

/**
 * Campaign row + effective reviewer role for the user.
 * Owner → role `owner`. Assigned collaborator → normalized assignment role. Else no access.
 */
export async function getCampaignReviewerAccess(
  db: Db,
  userId: number,
  campaignId: string
): Promise<CampaignReviewerAccess | null> {
  const campRows = await db.select().from(campaigns).where(eq(campaigns.id, campaignId)).limit(1);
  const camp = campRows[0];
  if (!camp) return null;

  if (String(camp.userId) === String(userId)) {
    return { campaign: camp, reviewerRole: "owner" };
  }

  const assignRows = await db
    .select()
    .from(campaignReviewerAssignments)
    .where(
      and(
        eq(campaignReviewerAssignments.campaignId, campaignId),
        eq(campaignReviewerAssignments.userId, String(userId))
      )
    )
    .limit(1);

  const a = assignRows[0];
  if (!a) return null;

  return { campaign: camp, reviewerRole: normalizeReviewerRole(a.role) };
}

/** @returns normalized role or null if the user has no access to the campaign */
export async function getCampaignReviewerRole(
  db: Db,
  userId: number,
  campaignId: string
): Promise<CampaignReviewerRole | null> {
  const access = await getCampaignReviewerAccess(db, userId, campaignId);
  return access?.reviewerRole ?? null;
}
