/**
 * Server rows for Bentley operational readiness (publish binding, worker, analytics timing).
 * Pair with `evaluateBentleyOperationalIssues` in autonomy readiness (needs workflow for launch-sync context).
 */

import { and, count, eq, min } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { campaignPosts, campaigns, revenueOsDeploymentFeedback, socialAccounts } from "@/lib/db/schema";
import type { BentleyOperationalPostInput } from "@/lib/revenue-os/bentley-operational-blockers";

export type BentleyOperationalRawFacts = {
  socialPlatformsConnected: string[];
  ambiguousSocialPlatforms: string[];
  posts: BentleyOperationalPostInput[];
  campaignPublishedPostCount: number;
  earliestPostedAtIso: string | null;
  deploymentFeedbackRows: number;
};

export async function fetchBentleyOperationalRawFacts(input: {
  userId: string;
  clientId: string;
  campaignId?: string | null;
}): Promise<BentleyOperationalRawFacts | null> {
  const uid = input.userId.trim();
  const cid = input.clientId.trim();
  if (!cid) return null;

  const db = await getDb();

  const accRows = await db
    .select({ platform: socialAccounts.platform })
    .from(socialAccounts)
    .where(and(eq(socialAccounts.userId, uid), eq(socialAccounts.clientId, cid)));

  const byPlat = new Map<string, number>();
  for (const a of accRows) {
    const k = String(a.platform ?? "").trim().toLowerCase();
    if (!k) continue;
    byPlat.set(k, (byPlat.get(k) ?? 0) + 1);
  }
  const socialPlatformsConnected = [...byPlat.keys()];
  const ambiguousSocialPlatforms = [...byPlat.entries()].filter(([, n]) => n > 1).map(([p]) => p);

  const campId = input.campaignId?.trim();
  let posts: BentleyOperationalPostInput[] = [];
  let campaignPublishedPostCount = 0;
  let earliestPostedAtIso: string | null = null;

  if (campId) {
    const own = await db
      .select({ id: campaigns.id })
      .from(campaigns)
      .where(and(eq(campaigns.id, campId), eq(campaigns.userId, uid), eq(campaigns.clientId, cid)))
      .limit(1);
    if (own.length > 0) {
      const rows = await db.select().from(campaignPosts).where(eq(campaignPosts.campaignId, campId));
      posts = rows.map((p) => ({
        platform: p.platform,
        status: p.status,
        scheduledAt: p.scheduledAt,
        socialAccountId: p.socialAccountId,
        utmParams: p.utmParams,
        errorMessage: p.errorMessage,
      }));

      const [agg] = await db
        .select({
          n: count(),
          minPosted: min(campaignPosts.postedAt),
        })
        .from(campaignPosts)
        .where(and(eq(campaignPosts.campaignId, campId), eq(campaignPosts.status, "POSTED")));
      campaignPublishedPostCount = Number(agg?.n ?? 0);
      const mp = agg?.minPosted;
      earliestPostedAtIso = mp ? new Date(mp as Date).toISOString() : null;
    }
  }

  const dfScope = and(eq(revenueOsDeploymentFeedback.userId, uid), eq(campaigns.clientId, cid));
  const [dfRes] = await db
    .select({ n: count() })
    .from(revenueOsDeploymentFeedback)
    .innerJoin(campaigns, eq(revenueOsDeploymentFeedback.campaignId, campaigns.id))
    .where(dfScope);
  const deploymentFeedbackRows = Number(dfRes?.n ?? 0);

  return {
    socialPlatformsConnected,
    ambiguousSocialPlatforms,
    posts,
    campaignPublishedPostCount,
    earliestPostedAtIso,
    deploymentFeedbackRows,
  };
}
