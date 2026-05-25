/**
 * Shared campaign post → social adapter publish (manual route + scheduled worker).
 *
 * Traceability: on success, adapters return `platformPostId` which is persisted on `campaign_posts.platform_post_id`
 * (LinkedIn URN from `X-RestLi-Id`, used by `/rest/socialActions/{urn}`; Instagram numeric media id from `media_publish`). Metric sync uses that id.
 */

import { eq, and, desc } from "drizzle-orm";
import {
  campaignPosts,
  campaigns,
  campaignAssets,
  socialAccounts,
} from "@/lib/db/schema";
import { getAdapter } from "@/lib/social/adapters";
import { decryptToken } from "@/lib/social/encrypt";
import { normalizeCampaignPostPlatformForPublish } from "@/lib/social/platform-identity";
import { parseScheduledPublishMeta } from "@/lib/social/scheduled-publish-meta";
import type { PublishResult } from "@/lib/social/types";
import type { SocialPlatform } from "@/lib/social/config";

export type CampaignPostPublishContext = {
  post: typeof campaignPosts.$inferSelect;
  campaign: typeof campaigns.$inferSelect;
  platformKey: SocialPlatform;
  accountRow: typeof socialAccounts.$inferSelect;
  accessToken: string;
  refreshToken: string | null;
  assetUrl?: string;
  /** Mirrors `campaign_assets.creative_type` when `post.asset_id` is set. */
  assetCreativeType?: string | null;
  finalLink?: string;
};

export class CampaignPostPublishError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "CampaignPostPublishError";
    this.code = code;
  }
}

/** Drizzle DB from `getDb()` — loose typing to avoid mysql2 generic drift. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function loadCampaignPostPublishContext(db: any, postId: string): Promise<CampaignPostPublishContext | null> {
  const postRows = await db.select().from(campaignPosts).where(eq(campaignPosts.id, postId)).limit(1);
  if (postRows.length === 0) return null;
  const post = postRows[0];

  const platformKey = normalizeCampaignPostPlatformForPublish(post.platform);
  if (!platformKey) {
    throw new CampaignPostPublishError("INVALID_PLATFORM", "Post platform is not a recognized social network.");
  }

  const campRows = await db
    .select()
    .from(campaigns)
    .where(eq(campaigns.id, post.campaignId))
    .limit(1);
  if (campRows.length === 0) {
    throw new CampaignPostPublishError("CAMPAIGN_NOT_FOUND", "Campaign not found.");
  }
  const campaign = campRows[0];

  let accountRows: (typeof socialAccounts.$inferSelect)[];

  if (post.socialAccountId?.trim()) {
    accountRows = await db
      .select()
      .from(socialAccounts)
      .where(
        and(
          eq(socialAccounts.id, post.socialAccountId.trim()),
          eq(socialAccounts.clientId, campaign.clientId),
          eq(socialAccounts.platform, platformKey)
        )
      )
      .limit(1);
  } else {
    accountRows = await db
      .select()
      .from(socialAccounts)
      .where(
        and(
          eq(socialAccounts.userId, campaign.userId),
          eq(socialAccounts.clientId, campaign.clientId),
          eq(socialAccounts.platform, platformKey)
        )
      )
      .orderBy(desc(socialAccounts.updatedAt))
      .limit(1);
  }

  if (accountRows.length === 0) {
    throw new CampaignPostPublishError(
      "ACCOUNT_NOT_CONNECTED",
      `Connect your ${platformKey} account first.`
    );
  }

  const accountRow = accountRows[0];
  const accessToken = decryptToken(accountRow.accessTokenEnc ?? "");
  const refreshToken = accountRow.refreshTokenEnc ? decryptToken(accountRow.refreshTokenEnc) : null;

  const adapter = getAdapter(platformKey);
  if (!adapter) {
    throw new CampaignPostPublishError(
      "PLATFORM_UNSUPPORTED",
      `${platformKey} publishing not implemented`
    );
  }

  let assetUrl: string | undefined;
  let assetCreativeType: string | null = null;
  if (post.assetId) {
    const assetRows = await db
      .select()
      .from(campaignAssets)
      .where(eq(campaignAssets.id, post.assetId))
      .limit(1);
    if (assetRows.length > 0) {
      assetUrl = assetRows[0].storageUrl ?? undefined;
      assetCreativeType = assetRows[0].creativeType ?? null;
    }
  }

  const linkUrl = post.linkUrl ?? undefined;
  const utm = post.utmParams as Record<string, string> | null;
  const finalLink =
    linkUrl && utm
      ? `${linkUrl}${linkUrl.includes("?") ? "&" : "?"}${new URLSearchParams(utm).toString()}`
      : linkUrl;

  return {
    post,
    campaign,
    platformKey,
    accountRow,
    accessToken,
    refreshToken,
    assetUrl,
    assetCreativeType,
    finalLink,
  };
}

export async function executeCampaignPostAdapterPublish(ctx: CampaignPostPublishContext): Promise<PublishResult> {
  if (parseScheduledPublishMeta(ctx.post.scheduledPublishMeta).publishRoute === "content360") {
    throw new CampaignPostPublishError(
      "CONTENT360_WRONG_EXECUTOR",
      "This post is routed to Content360 and must not be processed by a native social adapter.",
    );
  }
  const adapter = getAdapter(ctx.platformKey);
  if (!adapter) {
    throw new CampaignPostPublishError("PLATFORM_UNSUPPORTED", `${ctx.platformKey} publishing not implemented`);
  }
  return adapter.publish(
    {
      ...ctx.accountRow,
      accessToken: ctx.accessToken,
      refreshToken: ctx.refreshToken,
    },
    {
      caption: ctx.post.caption ?? "",
      assetUrl: ctx.assetUrl,
      assetCreativeType: ctx.assetCreativeType,
      linkUrl: ctx.finalLink,
      hashtags: ctx.post.hashtags ? ctx.post.hashtags.split(/\s+/).filter(Boolean) : undefined,
    }
  );
}
