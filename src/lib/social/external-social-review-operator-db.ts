import { and, desc, eq, gt, inArray, isNull, or } from "drizzle-orm";
import {
  campaignAuditEvents,
  campaignExternalSocialReviewTokens,
  campaignPosts,
  type CampaignRow,
} from "@/lib/db/schema";
import {
  buildPostClientLinkContext,
  findLastExternalClientReviewFromAuditRows,
  mapTokenRowToOperatorRow,
  pickPrimaryActiveToken,
  type ExternalReviewTokenOperatorRow,
  type LastExternalClientReviewSummary,
  type PostClientLinkContext,
} from "@/lib/social/external-social-review-operator-summary";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

export async function fetchCampaignIdsWithActiveExternalReviewToken(db: Db, campaignIds: string[]): Promise<Set<string>> {
  if (campaignIds.length === 0) return new Set();
  const now = new Date();
  const rows = await db
    .select({ campaignId: campaignExternalSocialReviewTokens.campaignId })
    .from(campaignExternalSocialReviewTokens)
    .where(
      and(
        inArray(campaignExternalSocialReviewTokens.campaignId, campaignIds),
        isNull(campaignExternalSocialReviewTokens.revokedAt),
        or(
          isNull(campaignExternalSocialReviewTokens.expiresAt),
          gt(campaignExternalSocialReviewTokens.expiresAt, now)
        )
      )
    );
  return new Set(rows.map((r: { campaignId: string }) => r.campaignId));
}

export type ExternalReviewOperatorApiSummary = {
  tokens: ExternalReviewTokenOperatorRow[];
  primaryActiveToken: ExternalReviewTokenOperatorRow | null;
  activeTokenCount: number;
  lastExternalClientReview: LastExternalClientReviewSummary | null;
  postContext: PostClientLinkContext | null;
};

export async function buildExternalReviewOperatorApiSummary(args: {
  db: Db;
  campaignId: string;
  postId: string | null;
  campaign: CampaignRow;
}): Promise<ExternalReviewOperatorApiSummary> {
  const { db, campaignId, postId, campaign } = args;

  const tokenRows = await db
    .select()
    .from(campaignExternalSocialReviewTokens)
    .where(eq(campaignExternalSocialReviewTokens.campaignId, campaignId))
    .orderBy(desc(campaignExternalSocialReviewTokens.createdAt))
    .limit(30);

  const tokens: ExternalReviewTokenOperatorRow[] = tokenRows.map(
    (row: typeof campaignExternalSocialReviewTokens.$inferSelect) => mapTokenRowToOperatorRow(row)
  );

  const primaryActiveToken = pickPrimaryActiveToken(tokens);
  const activeTokenCount = tokens.filter((t) => t.status === "active").length;

  const auditCandidates = await db
    .select({
      action: campaignAuditEvents.action,
      postId: campaignAuditEvents.postId,
      details: campaignAuditEvents.details,
      createdAt: campaignAuditEvents.createdAt,
    })
    .from(campaignAuditEvents)
    .innerJoin(campaignPosts, eq(campaignAuditEvents.postId, campaignPosts.id))
    .where(
      and(
        eq(campaignPosts.campaignId, campaignId),
        inArray(campaignAuditEvents.action, ["publish_approval_approved", "publish_approval_rejected"])
      )
    )
    .orderBy(desc(campaignAuditEvents.createdAt))
    .limit(60);

  const lastExternalClientReview = findLastExternalClientReviewFromAuditRows(auditCandidates);

  let postContext: PostClientLinkContext | null = null;
  if (postId) {
    const postRows = await db.select().from(campaignPosts).where(eq(campaignPosts.id, postId)).limit(1);
    const post = postRows[0];
    if (post && post.campaignId === campaignId) {
      postContext = buildPostClientLinkContext({
        post,
        campaign,
        primaryActiveAllowedRoles: primaryActiveToken?.allowedRoles ?? [],
        hasActiveClientReviewToken: primaryActiveToken != null,
      });
    }
  }

  return {
    tokens,
    primaryActiveToken,
    activeTokenCount,
    lastExternalClientReview,
    postContext,
  };
}
