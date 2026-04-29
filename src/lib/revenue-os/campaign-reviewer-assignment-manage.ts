import { eq } from "drizzle-orm";
import { campaigns, type CampaignRow } from "@/lib/db/schema";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

export function isCampaignReviewerManagementAllowed(
  campaignOwnerUserId: string,
  requestUserId: number,
  adminSession: boolean
): boolean {
  if (adminSession) return true;
  return String(campaignOwnerUserId) === String(requestUserId);
}

export type ReviewerManageAuthResult =
  | { ok: true; campaign: CampaignRow }
  | { ok: false; status: 404 | 403; body: { error: string; message: string } };

/**
 * Load campaign by id. Allow management only for campaign owner or admin session.
 * Collaborators and unknown users get 403; missing campaign → 404.
 */
export async function requireCampaignReviewerAssignmentManageAuth(
  db: Db,
  requestUserId: number,
  campaignId: string,
  adminSession: boolean
): Promise<ReviewerManageAuthResult> {
  const rows = await db.select().from(campaigns).where(eq(campaigns.id, campaignId)).limit(1);
  const campaign = rows[0];
  if (!campaign) {
    return {
      ok: false,
      status: 404,
      body: { error: "NOT_FOUND", message: "Campaign not found." },
    };
  }
  if (!isCampaignReviewerManagementAllowed(campaign.userId, requestUserId, adminSession)) {
    return {
      ok: false,
      status: 403,
      body: {
        error: "FORBIDDEN_REVIEWER_MANAGEMENT",
        message: "You do not have permission to manage reviewers for this campaign.",
      },
    };
  }
  return { ok: true, campaign };
}
