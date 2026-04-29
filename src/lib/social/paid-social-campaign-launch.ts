/**
 * Meta Ads launch orchestration (Part 49). Gated by PAID_SOCIAL_META_ADS_EXECUTION_ENABLED.
 */

import crypto from "crypto";
import { and, desc, eq } from "drizzle-orm";
import {
  campaignAuditEvents,
  campaignPaidSocialCampaigns,
  campaigns,
  campaignAssets,
  socialAccounts,
} from "@/lib/db/schema";
import { decryptToken } from "@/lib/social/encrypt";
import { isMetaAdsLaunchFeatureEnabled } from "@/lib/social/paid-social-meta-execution-flag";
import {
  MetaMarketingApiError,
  mapCtaLabelToMetaType,
  mapDraftObjectiveToMetaCampaignObjective,
  mapOptimizationGoalForObjective,
  metaCreateAd,
  metaCreateAdCreativeLink,
  metaCreateAdSet,
  metaCreateCampaign,
  metaUploadAdImageFromUrl,
  buildTargetingJson,
} from "@/lib/social/paid-social-meta-marketing-api";
import {
  getPaidSocialCampaignById,
  buildReadinessForPaidSocialRow,
  loadPrimaryAssetHintsForPaidSocialRows,
  projectPaidSocialCampaignPublic,
  parseJsonCreative,
  parseJsonPlacements,
  parseJsonAudience,
  type PaidSocialCampaignPublic,
} from "@/lib/social/paid-social-campaigns";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

export type PaidSocialLaunchErrorCode =
  | "LAUNCH_DISABLED"
  | "NOT_LAUNCHABLE"
  | "ALREADY_LAUNCHED"
  | "LAUNCH_IN_PROGRESS"
  | "NO_ACCESS_TOKEN"
  | "META_API"
  | "NOT_FOUND";

export class PaidSocialLaunchError extends Error {
  readonly code: PaidSocialLaunchErrorCode;
  readonly details?: unknown;

  constructor(code: PaidSocialLaunchErrorCode, message?: string, details?: unknown) {
    super(message ?? code);
    this.code = code;
    this.details = details;
  }
}

async function insertLaunchAudit(
  db: Db,
  userId: number,
  action: "paid_social_campaign_launch_requested" | "paid_social_campaign_launched" | "paid_social_campaign_launch_failed",
  details: Record<string, unknown>
): Promise<void> {
  await db.insert(campaignAuditEvents).values({
    id: crypto.randomUUID(),
    userId: String(userId),
    postId: null,
    action,
    platform: "paid_social",
    details,
    createdAt: new Date(),
  });
}

export async function resolveMetaMarketingAccessToken(
  db: Db,
  args: { campaignUserId: string; clientId: string; preferredFacebookSocialAccountId?: string | null }
): Promise<string | null> {
  const envTok = process.env.META_MARKETING_ACCESS_TOKEN?.trim();
  if (envTok) return envTok;

  const whereParts = [
    eq(socialAccounts.userId, args.campaignUserId),
    eq(socialAccounts.clientId, args.clientId),
    eq(socialAccounts.platform, "facebook"),
  ];
  if (args.preferredFacebookSocialAccountId?.trim()) {
    whereParts.push(eq(socialAccounts.id, args.preferredFacebookSocialAccountId.trim()));
  }
  const rows = await db
    .select()
    .from(socialAccounts)
    .where(whereParts.length === 1 ? whereParts[0] : and(...whereParts))
    .orderBy(desc(socialAccounts.updatedAt))
    .limit(1);
  const acc = rows[0];
  if (!acc?.accessTokenEnc) return null;
  const plain = decryptToken(acc.accessTokenEnc);
  return plain?.trim() || null;
}

export async function executePaidSocialMetaLaunch(
  db: Db,
  args: { paidCampaignId: string; campaignId: string; userId: number }
): Promise<{ ok: true; paidCampaign: PaidSocialCampaignPublic }> {
  if (!isMetaAdsLaunchFeatureEnabled()) {
    throw new PaidSocialLaunchError("LAUNCH_DISABLED", "Meta ads launch is disabled (feature flag off).");
  }

  const row = await getPaidSocialCampaignById(db, args.paidCampaignId);
  if (!row || row.campaignId !== args.campaignId || row.provider !== "meta_ads") {
    throw new PaidSocialLaunchError("NOT_FOUND", "Paid campaign not found.");
  }

  const campRows = await db.select().from(campaigns).where(eq(campaigns.id, args.campaignId)).limit(1);
  const campaign = campRows[0];
  if (!campaign) {
    throw new PaidSocialLaunchError("NOT_FOUND", "Campaign not found.");
  }

  const st = (row.metaLaunchStatus ?? "idle").toLowerCase();
  if (st === "launching") {
    throw new PaidSocialLaunchError("LAUNCH_IN_PROGRESS", "Launch already in progress.");
  }
  if (st === "launched" || (row.remoteMetaCampaignId && String(row.remoteMetaCampaignId).trim() !== "")) {
    throw new PaidSocialLaunchError("ALREADY_LAUNCHED", "This draft already has a Meta campaign id.");
  }

  const hintsMap = await loadPrimaryAssetHintsForPaidSocialRows(db, args.campaignId, [row]);
  const hint = hintsMap.get(row.id) ?? { creativeType: null, hasStorageUrl: false };
  const readiness = buildReadinessForPaidSocialRow(row, hint);
  if (!readiness.launchEligible) {
    throw new PaidSocialLaunchError("NOT_LAUNCHABLE", "Draft is not launch-ready.", {
      launchBlockedReasons: readiness.launchBlockedReasons,
    });
  }

  const accessToken = await resolveMetaMarketingAccessToken(db, {
    campaignUserId: String(campaign.userId),
    clientId: String(campaign.clientId ?? ""),
    preferredFacebookSocialAccountId: row.metaFacebookSocialAccountId,
  });
  if (!accessToken) {
    throw new PaidSocialLaunchError(
      "NO_ACCESS_TOKEN",
      "No Marketing API token: set META_MARKETING_ACCESS_TOKEN or connect a Facebook social account for this client."
    );
  }

  const adAccountRaw = (row.metaAdAccountId ?? "").replace(/^act_/i, "").trim();
  const actPath = adAccountRaw ? `act_${adAccountRaw}` : "";
  const pageId = (row.metaPageId ?? "").trim();
  if (!actPath || !pageId) {
    throw new PaidSocialLaunchError("NOT_LAUNCHABLE", "Missing Meta ad account or Page id.");
  }

  const cr = parseJsonCreative(row);
  const firstAssetId = cr.primaryAssetIds?.[0];
  if (!firstAssetId) {
    throw new PaidSocialLaunchError("NOT_LAUNCHABLE", "Missing primary image asset.");
  }
  const [assetRow] = await db
    .select()
    .from(campaignAssets)
    .where(and(eq(campaignAssets.id, firstAssetId), eq(campaignAssets.campaignId, args.campaignId)))
    .limit(1);
  const imageUrl = assetRow?.storageUrl?.trim() || "";
  if (!imageUrl || !/^https?:\/\//i.test(imageUrl)) {
    throw new PaidSocialLaunchError("NOT_LAUNCHABLE", "Image asset must have an http(s) storage URL Meta can fetch.");
  }

  await db
    .update(campaignPaidSocialCampaigns)
    .set({
      metaLaunchStatus: "launching",
      lastLaunchErrorJson: null,
      updatedByUserId: String(args.userId),
    })
    .where(
      and(eq(campaignPaidSocialCampaigns.id, args.paidCampaignId), eq(campaignPaidSocialCampaigns.campaignId, args.campaignId))
    );

  await insertLaunchAudit(db, args.userId, "paid_social_campaign_launch_requested", {
    paidCampaignId: args.paidCampaignId,
    campaignId: args.campaignId,
    provider: "meta_ads",
    objective: row.objective,
    metaAdAccountId: actPath,
    metaPageId: pageId,
  });

  try {
    const placements = parseJsonPlacements(row);
    const aud = parseJsonAudience(row);
    const targeting = buildTargetingJson({
      placements,
      geographyNotes: aud.geography ?? null,
      ageMin: aud.ageMin,
      ageMax: aud.ageMax,
    });

    const campaignObjective = mapDraftObjectiveToMetaCampaignObjective(row.objective);
    const optGoal = mapOptimizationGoalForObjective(row.objective);

    const { hash: imageHash } = await metaUploadAdImageFromUrl({
      accessToken,
      adAccountActId: actPath,
      imageUrl,
    });

    const { id: remoteCampaignId } = await metaCreateCampaign({
      accessToken,
      adAccountActId: actPath,
      name: row.internalName || "Revenue OS paid campaign",
      objective: campaignObjective,
    });

    const daily =
      String(row.budgetType || "").toLowerCase() === "daily" ? row.budgetAmountMinor ?? null : null;
    const lifetime =
      String(row.budgetType || "").toLowerCase() === "lifetime" ? row.budgetAmountMinor ?? null : null;

    const { id: remoteAdsetId } = await metaCreateAdSet({
      accessToken,
      adAccountActId: actPath,
      name: row.adSetName?.trim() || `${row.internalName} ad set`,
      campaignId: remoteCampaignId,
      dailyBudgetMinor: daily,
      lifetimeBudgetMinor: lifetime,
      optimizationGoal: optGoal,
      targeting,
      destinationUrl: (row.destinationUrl ?? "").trim(),
    });

    const cta = mapCtaLabelToMetaType(row.ctaLabel);
    const { id: remoteCreativeId } = await metaCreateAdCreativeLink({
      accessToken,
      adAccountActId: actPath,
      name: row.internalName || "creative",
      pageId,
      link: (row.destinationUrl ?? "").trim(),
      message: cr.notes?.trim() || row.internalName || " ",
      imageHash,
      ctaType: cta,
    });

    const { id: remoteAdId } = await metaCreateAd({
      accessToken,
      adAccountActId: actPath,
      name: row.adName?.trim() || `${row.internalName} ad`,
      adsetId: remoteAdsetId,
      creativeId: remoteCreativeId,
    });

    const now = new Date();
    await db
      .update(campaignPaidSocialCampaigns)
      .set({
        metaLaunchStatus: "launched",
        remoteMetaCampaignId: remoteCampaignId,
        remoteMetaAdsetId: remoteAdsetId,
        remoteMetaCreativeId: remoteCreativeId,
        remoteMetaAdId: remoteAdId,
        launchedAt: now,
        lastMetaSyncAt: now,
        lastLaunchErrorJson: null,
        updatedByUserId: String(args.userId),
      })
      .where(
        and(eq(campaignPaidSocialCampaigns.id, args.paidCampaignId), eq(campaignPaidSocialCampaigns.campaignId, args.campaignId))
      );

    await insertLaunchAudit(db, args.userId, "paid_social_campaign_launched", {
      paidCampaignId: args.paidCampaignId,
      campaignId: args.campaignId,
      provider: "meta_ads",
      objective: row.objective,
      metaAdAccountId: actPath,
      remoteCampaignId,
      remoteAdsetId,
      remoteCreativeId,
      remoteAdId,
    });

    const next = await getPaidSocialCampaignById(db, args.paidCampaignId);
    if (!next) throw new PaidSocialLaunchError("NOT_FOUND", "Paid campaign missing after launch.");
    const pub = await projectPaidSocialCampaignPublic(db, next, args.campaignId);
    return { ok: true, paidCampaign: pub };
  } catch (e) {
    const msg =
      e instanceof MetaMarketingApiError
        ? e.message
        : e instanceof Error
          ? e.message
          : String(e);
    const errJson = {
      message: msg,
      at: new Date().toISOString(),
      metaCode: e instanceof MetaMarketingApiError ? e.metaCode : undefined,
      errorSubcode: e instanceof MetaMarketingApiError ? e.errorSubcode : undefined,
    };
    await db
      .update(campaignPaidSocialCampaigns)
      .set({
        metaLaunchStatus: "failed",
        lastLaunchErrorJson: errJson,
        remoteMetaCampaignId: null,
        remoteMetaAdsetId: null,
        remoteMetaCreativeId: null,
        remoteMetaAdId: null,
        updatedByUserId: String(args.userId),
      })
      .where(
        and(eq(campaignPaidSocialCampaigns.id, args.paidCampaignId), eq(campaignPaidSocialCampaigns.campaignId, args.campaignId))
      );

    await insertLaunchAudit(db, args.userId, "paid_social_campaign_launch_failed", {
      paidCampaignId: args.paidCampaignId,
      campaignId: args.campaignId,
      provider: "meta_ads",
      objective: row.objective,
      error: msg,
    });

    if (e instanceof PaidSocialLaunchError) throw e;
    if (e instanceof MetaMarketingApiError) {
      throw new PaidSocialLaunchError("META_API", msg, errJson);
    }
    throw new PaidSocialLaunchError("META_API", msg, errJson);
  }
}
