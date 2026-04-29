/**
 * Orchestrates Meta readback + DB updates + paid analytics snapshots (Parts 50–51).
 */

import crypto from "crypto";
import { and, eq } from "drizzle-orm";
import { campaignAuditEvents, campaignPaidSocialCampaigns, campaigns } from "@/lib/db/schema";
import { isMetaAdsLaunchFeatureEnabled } from "@/lib/social/paid-social-meta-execution-flag";
import { resolveMetaMarketingAccessToken } from "@/lib/social/paid-social-campaign-launch";
import {
  getPaidSocialCampaignById,
  projectPaidSocialCampaignPublic,
} from "@/lib/social/paid-social-campaigns";
import { readMetaPaidCampaignBundle } from "@/lib/social/paid-social-meta-sync";
import { insertPaidSocialAnalyticsSnapshot } from "@/lib/social/paid-social-analytics-store";
import { summarizePaidMetaSyncBundle } from "@/lib/social/paid-social-meta-sync-failure-policy";
import type { PaidMetaSyncFailureCategory } from "@/lib/social/paid-social-meta-sync-failure-policy";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

export type PaidSocialSyncErrorCode = "SYNC_DISABLED" | "NOT_FOUND" | "NO_REMOTE_IDS" | "NO_ACCESS_TOKEN";

export class PaidSocialSyncError extends Error {
  readonly code: PaidSocialSyncErrorCode;

  constructor(code: PaidSocialSyncErrorCode, message?: string) {
    super(message ?? code);
    this.code = code;
  }
}

async function insertSyncAudit(
  db: Db,
  userId: number,
  action: "paid_social_campaign_synced" | "paid_social_campaign_sync_failed",
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

export type SyncPaidSocialMetaResult = {
  ok: true;
  paidCampaign: Awaited<ReturnType<typeof projectPaidSocialCampaignPublic>>;
  sync: {
    snapshotInserted: boolean;
    runtimeStatus: string | null;
    warningCount: number;
    phasesWithErrors: string[];
    hadThrottlePhase: boolean;
    hadAuthPhase: boolean;
    syncFailedTotally: boolean;
    worstHardCategory: PaidMetaSyncFailureCategory | null;
    insightsSource: "ad" | "adset" | "campaign" | null;
    metricsCompleteness: "full" | "partial_early_delivery" | "none";
    sourceNotes: string[];
    usedFallbackInsights: boolean;
  };
};

/**
 * Pull Meta status + lifetime insights (ad with ad set / campaign fallback), update row, append snapshot when metrics exist.
 */
export async function syncPaidSocialMetaCampaign(
  db: Db,
  args: {
    paidCampaignId: string;
    campaignId: string;
    userId: number;
    skipAudit?: boolean;
  }
): Promise<SyncPaidSocialMetaResult> {
  if (!isMetaAdsLaunchFeatureEnabled()) {
    throw new PaidSocialSyncError("SYNC_DISABLED", "Meta paid sync requires PAID_SOCIAL_META_ADS_EXECUTION_ENABLED.");
  }

  const row = await getPaidSocialCampaignById(db, args.paidCampaignId);
  if (!row || row.campaignId !== args.campaignId || row.provider !== "meta_ads") {
    throw new PaidSocialSyncError("NOT_FOUND", "Paid campaign not found.");
  }

  const remoteCampaign = row.remoteMetaCampaignId?.trim() || null;
  const remoteAdset = row.remoteMetaAdsetId?.trim() || null;
  const remoteAd = row.remoteMetaAdId?.trim() || null;

  if (!remoteCampaign && !remoteAdset && !remoteAd) {
    throw new PaidSocialSyncError("NO_REMOTE_IDS", "Nothing to sync — launch the draft first to create Meta objects.");
  }

  const campRows = await db.select().from(campaigns).where(eq(campaigns.id, args.campaignId)).limit(1);
  const campaign = campRows[0];
  if (!campaign) {
    throw new PaidSocialSyncError("NOT_FOUND", "Campaign not found.");
  }

  const accessToken = await resolveMetaMarketingAccessToken(db, {
    campaignUserId: String(campaign.userId),
    clientId: String(campaign.clientId ?? ""),
    preferredFacebookSocialAccountId: row.metaFacebookSocialAccountId,
  });
  if (!accessToken) {
    throw new PaidSocialSyncError(
      "NO_ACCESS_TOKEN",
      "No Marketing API token: set META_MARKETING_ACCESS_TOKEN or connect Facebook for this client."
    );
  }

  const bundle = await readMetaPaidCampaignBundle(accessToken, {
    remoteCampaignId: remoteCampaign,
    remoteAdsetId: remoteAdset,
    remoteAdId: remoteAd,
  });

  const now = new Date();
  const hasAnyNode = bundle.campaign != null || bundle.adset != null || bundle.ad != null;
  const hasMetrics =
    bundle.normalizedMetrics != null &&
    (bundle.normalizedMetrics.impressions != null ||
      bundle.normalizedMetrics.clicks != null ||
      bundle.normalizedMetrics.spendMinor != null ||
      bundle.normalizedMetrics.reach != null);

  const failureSummary = summarizePaidMetaSyncBundle({
    phaseErrors: bundle.errors.map((e) => ({ kind: e.kind })),
    hasAnyNode,
  });

  const syncFailedTotally = failureSummary.isTotalFailure;
  const usedFallbackInsights = bundle.insightsSource === "adset" || bundle.insightsSource === "campaign";

  const statusPayload = {
    fetchedAt: now.toISOString(),
    campaign: bundle.campaign,
    adset: bundle.adset,
    ad: bundle.ad,
    phaseErrors: bundle.errors,
    insightsSource: bundle.insightsSource,
    metricsCompleteness: bundle.metricsCompleteness,
    sourceNotes: bundle.sourceNotes,
  };

  const syncErrorJson =
    bundle.errors.length > 0
      ? {
          at: now.toISOString(),
          errors: bundle.errors,
          partial: hasAnyNode,
          worstHardCategory: failureSummary.worstHardCategory,
          hadThrottle: failureSummary.hadThrottle,
          hadAuth: failureSummary.hadAuth,
        }
      : null;

  let snapshotInserted = false;
  if (hasMetrics && bundle.normalizedMetrics) {
    await insertPaidSocialAnalyticsSnapshot(db, {
      id: crypto.randomUUID(),
      campaignPaidSocialCampaignId: args.paidCampaignId,
      provider: "meta_ads",
      payload: {
        normalized: bundle.normalizedMetrics,
        raw: bundle.insights ?? undefined,
        meta: {
          insightsSource: bundle.insightsSource,
          sourceNotes: bundle.sourceNotes,
          metricsCompleteness: bundle.metricsCompleteness,
          usedFallbackInsights,
        },
      },
      fetchedAt: now,
    });
    snapshotInserted = true;
  }

  await db
    .update(campaignPaidSocialCampaigns)
    .set({
      metaRuntimeStatus: bundle.runtimeStatus,
      lastMetaStatusJson: statusPayload as unknown as Record<string, unknown>,
      lastMetaSyncAt: now,
      lastMetaSyncErrorJson: syncErrorJson as Record<string, unknown> | null,
      updatedByUserId: String(args.userId),
      updatedAt: new Date(),
    })
    .where(
      and(eq(campaignPaidSocialCampaigns.id, args.paidCampaignId), eq(campaignPaidSocialCampaigns.campaignId, args.campaignId))
    );

  if (!args.skipAudit) {
    const phasesWithErrors = bundle.errors.map((e) => e.phase);
    if (syncFailedTotally) {
      await insertSyncAudit(db, args.userId, "paid_social_campaign_sync_failed", {
        paidCampaignId: args.paidCampaignId,
        campaignId: args.campaignId,
        provider: "meta_ads",
        phasesWithErrors,
        summary: bundle.errors[0]?.message ?? "sync failed",
        worstHardCategory: failureSummary.worstHardCategory,
        hadThrottle: failureSummary.hadThrottle,
        hadAuth: failureSummary.hadAuth,
      });
    } else {
      await insertSyncAudit(db, args.userId, "paid_social_campaign_synced", {
        paidCampaignId: args.paidCampaignId,
        campaignId: args.campaignId,
        provider: "meta_ads",
        runtimeStatus: bundle.runtimeStatus,
        snapshotInserted,
        warningCount: bundle.errors.length,
        phasesWithErrors: phasesWithErrors.length ? phasesWithErrors : undefined,
        worstHardCategory: failureSummary.worstHardCategory ?? undefined,
        hadThrottle: failureSummary.hadThrottle,
        insightsSource: bundle.insightsSource ?? undefined,
        metricsCompleteness: bundle.metricsCompleteness,
        usedFallbackInsights,
        sourceNotes: bundle.sourceNotes.length ? bundle.sourceNotes : undefined,
      });
    }
  }

  const next = await getPaidSocialCampaignById(db, args.paidCampaignId);
  if (!next) throw new PaidSocialSyncError("NOT_FOUND", "Paid campaign missing after sync.");
  const paidCampaign = await projectPaidSocialCampaignPublic(db, next, args.campaignId);

  return {
    ok: true,
    paidCampaign,
    sync: {
      snapshotInserted,
      runtimeStatus: bundle.runtimeStatus,
      warningCount: bundle.errors.length,
      phasesWithErrors: bundle.errors.map((e) => e.phase),
      hadThrottlePhase: failureSummary.hadThrottle,
      hadAuthPhase: failureSummary.hadAuth,
      syncFailedTotally,
      worstHardCategory: failureSummary.worstHardCategory,
      insightsSource: bundle.insightsSource,
      metricsCompleteness: bundle.metricsCompleteness,
      sourceNotes: bundle.sourceNotes,
      usedFallbackInsights,
    },
  };
}
