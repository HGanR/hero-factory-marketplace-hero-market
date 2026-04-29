import { and, desc, eq, gt, inArray, isNull, or } from "drizzle-orm";
import { campaignExternalSocialReviewTokens } from "@/lib/db/schema";

export type BulkRevokeExternalReviewMode = "all_active" | "all_except_primary";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

/**
 * Revokes active (unrevoked, unexpired) external review tokens for a campaign.
 * Does not write audit rows — caller handles observability.
 */
export async function bulkRevokeExternalReviewTokensForCampaign(args: {
  db: Db;
  campaignId: string;
  mode: BulkRevokeExternalReviewMode;
}): Promise<{
  revokedCount: number;
  revokedTokenIds: string[];
  remainingActiveCount: number;
}> {
  const { db, campaignId, mode } = args;
  const now = new Date();

  const rows = await db
    .select()
    .from(campaignExternalSocialReviewTokens)
    .where(
      and(
        eq(campaignExternalSocialReviewTokens.campaignId, campaignId),
        isNull(campaignExternalSocialReviewTokens.revokedAt),
        or(
          isNull(campaignExternalSocialReviewTokens.expiresAt),
          gt(campaignExternalSocialReviewTokens.expiresAt, now)
        )
      )
    )
    .orderBy(desc(campaignExternalSocialReviewTokens.createdAt));

  let toRevoke: string[] = [];
  if (mode === "all_active") {
    toRevoke = rows.map((r: { id: string }) => r.id);
  } else {
    if (rows.length <= 1) {
      toRevoke = [];
    } else {
      toRevoke = rows.slice(1).map((r: { id: string }) => r.id);
    }
  }

  if (toRevoke.length === 0) {
    return { revokedCount: 0, revokedTokenIds: [], remainingActiveCount: rows.length };
  }

  await db
    .update(campaignExternalSocialReviewTokens)
    .set({ revokedAt: now, updatedAt: now })
    .where(inArray(campaignExternalSocialReviewTokens.id, toRevoke));

  return {
    revokedCount: toRevoke.length,
    revokedTokenIds: toRevoke,
    remainingActiveCount: rows.length - toRevoke.length,
  };
}
