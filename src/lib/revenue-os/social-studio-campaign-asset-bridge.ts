import type { MySql2Database } from "drizzle-orm/mysql2";
import { eq } from "drizzle-orm";
import crypto from "crypto";
import * as schema from "@/lib/db/schema";
import type { socialMediaAssets } from "@/lib/db/schema";

export type PromoteAssetResult = {
  campaignAssetId: string;
  created: boolean;
  /** True when URL is https (or http) suitable for Meta/IG adapters; data: URLs are not. */
  hostedMediaOk: boolean;
  storageUrl: string | null;
  publishMediaWarning: string | null;
};

function isHostedWebUrl(u: string | null | undefined): boolean {
  const t = u?.trim() ?? "";
  if (!t || t.startsWith("data:")) return false;
  return t.startsWith("https://") || t.startsWith("http://");
}

/**
 * Reuse an existing `campaign_assets` row when this Social Studio asset was already bridged; otherwise insert.
 */
export async function promoteSocialStudioAssetToCampaignAsset(
  db: MySql2Database<typeof schema>,
  args: {
    userId: string;
    campaignId: string;
    socialAsset: typeof socialMediaAssets.$inferSelect;
    /** Governs `campaign_posts.platform` for this promote */
    targetPlatform?: string;
  }
): Promise<PromoteAssetResult> {
  const { campaignId, socialAsset, targetPlatform } = args;

  const existing = await db
    .select()
    .from(schema.campaignAssets)
    .where(eq(schema.campaignAssets.campaignId, campaignId));

  const match = existing.find((r) => {
    const m = r.metadata as Record<string, unknown> | null;
    return m && String(m.social_studio_asset_id ?? "") === socialAsset.id;
  });
  if (match) {
    const url = match.storageUrl ?? null;
    const hosted = isHostedWebUrl(url);
    return {
      campaignAssetId: match.id,
      created: false,
      hostedMediaOk: hosted,
      storageUrl: url,
      publishMediaWarning: hosted
        ? null
        : "Asset is not a hosted HTTPS URL — connect Pinata or upload before direct publish to image-required networks.",
    };
  }

  const id = crypto.randomUUID();
  const url = socialAsset.storageUrl?.trim() || null;
  const hosted = isHostedWebUrl(url);
  const metadata = {
    source: "social_studio",
    generation_run_id: socialAsset.generationRunId ?? null,
    social_studio_asset_id: socialAsset.id,
    target_platform: targetPlatform?.trim() ?? null,
    platform_targets: socialAsset.platformTargetsJson ?? null,
    generation_metadata: socialAsset.generationMetadataJson ?? null,
  };

  await db.insert(schema.campaignAssets).values({
    id,
    campaignId,
    creativeType: "IMAGE",
    storageUrl: url,
    metadata,
  });

  return {
    campaignAssetId: id,
    created: true,
    hostedMediaOk: hosted,
    storageUrl: url,
    publishMediaWarning: hosted
      ? null
      : "Native asset is a data URL or missing URL — Instagram/Facebook image posts need a public HTTPS image. Create a draft and host the asset before publishing.",
  };
}
