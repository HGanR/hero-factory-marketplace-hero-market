/**
 * Paid social campaign drafts — persistence, validation, audit (Parts 48–49).
 * Organic posts remain on `campaign_posts`; this is additive scaffolding + optional Meta launch.
 */

import crypto from "crypto";
import { and, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import {
  campaignAssets,
  campaignAuditEvents,
  campaignPaidSocialCampaigns,
  campaignPosts,
  campaigns,
  socialAccounts,
  type CampaignPaidSocialCampaignRow,
} from "@/lib/db/schema";
import {
  derivePaidSocialCampaignReadiness,
  isPaidSocialAdProvider,
  type PaidSocialAudienceSummary,
  type PaidSocialCreativeConfig,
  type PaidSocialMetaExecutionReadinessInput,
} from "@/lib/social/paid-social-campaign-readiness";
import { isMetaAdsLaunchFeatureEnabled } from "@/lib/social/paid-social-meta-execution-flag";
import { derivePaidLaunchLifecycle } from "@/lib/social/paid-social-campaign-state";
import {
  getLatestPaidSocialAnalyticsSnapshot,
  getLatestPaidSocialAnalyticsSnapshotsForPaidCampaignIds,
  type PaidSocialAnalyticsSnapshotRow,
} from "@/lib/social/paid-social-analytics-store";
import { logPaidListProjection } from "@/lib/social/paid-social-list-projection-log";
import type { PaidSocialNormalizedMetrics } from "@/lib/social/paid-social-analytics-normalize";
import { derivePaidSyncHealth, type PaidSyncHealth } from "@/lib/social/paid-social-campaign-sync-health";
import {
  projectPaidStructuredSyncError,
  type PaidStructuredSyncErrorProjection,
} from "@/lib/social/paid-social-sync-error-projection";
import {
  normalizePaidSyncAccountKey,
  PAID_SYNC_PROVIDER_META_ADS,
  reloadPaidSyncBackoffRow,
} from "@/lib/social/paid-social-sync-backoff-state";
import { projectPaidSyncCooldownFromBackoffRow, type PaidSyncCooldownProjection } from "@/lib/social/paid-social-sync-cooldown-projection";
import { loadPaidSyncCooldownProjectionsForAccountKeys } from "@/lib/social/paid-social-sync-cooldown-batch";
import { derivePaidOptimizationSignals, type PaidOptimizationSignal } from "@/lib/social/paid-social-optimization-signals";
import type { NormalizedSocialPostMetrics } from "@/lib/social/governed-post-analytics-types";
import { parseStoredAnalyticsPayload } from "@/lib/social/governed-post-analytics-normalize";
import { getLatestAnalyticsSnapshotRowsForPostIds } from "@/lib/social/governed-post-analytics-store";
import { deriveOrganicPerformanceSignals } from "@/lib/social/organic-performance-signals";
import {
  deriveCrossSurfaceAnalyticsSignals,
  deriveCrossSurfaceComparisonReadiness,
  deriveCrossSurfacePromotionOutcomes,
  meetsCrossSurfacePromotionMinimumSample,
  type CrossSurfaceAnalyticsSignal,
  type CrossSurfaceComparisonReadiness,
  type CrossSurfaceComparisonReadinessReason,
  type CrossSurfacePromotionOutcomes,
} from "@/lib/social/cross-surface-analytics-signals";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

export type {
  CrossSurfaceAnalyticsSignal,
  CrossSurfaceComparisonReadiness,
  CrossSurfacePromotionOutcomes,
} from "@/lib/social/cross-surface-analytics-signals";

export type PaidSocialCampaignErrorCode =
  | "NOT_FOUND"
  | "INVALID_PROVIDER"
  | "ASSET_NOT_IN_CAMPAIGN"
  | "POST_NOT_IN_CAMPAIGN"
  | "POST_NOT_POSTED"
  | "DUPLICATE_REFERENCE_ORGANIC_POST"
  | "INSERT_FAILED"
  | "INVALID_FB_SOCIAL_ACCOUNT";

/** Part 60: 409 payload fields when a second promote is attempted for the same organic post. */
export type PaidSocialDuplicateReferenceDetails = {
  existingCampaignId: string;
  existingDraftId: string;
  existingStatus: string;
  existingName: string;
  paidCreativeSource: "organic_post" | "manual";
};

export class PaidSocialCampaignError extends Error {
  readonly code: PaidSocialCampaignErrorCode;
  readonly duplicateReference?: PaidSocialDuplicateReferenceDetails;

  constructor(
    code: PaidSocialCampaignErrorCode,
    message?: string,
    duplicateReference?: PaidSocialDuplicateReferenceDetails
  ) {
    super(message ?? code);
    this.code = code;
    this.duplicateReference = duplicateReference;
  }
}

/**
 * Canonical organic post id from stored `creative_config_json` (Part 60).
 * Aligns with API `referenceCampaignPostId` / patch `creative.referenceOrganicPostId`.
 */
export function referencedOrganicPostIdFromCreativeConfigJson(j: unknown): string | null {
  if (!j || typeof j !== "object" || Array.isArray(j)) return null;
  const id = (j as Record<string, unknown>).referenceOrganicPostId;
  if (typeof id !== "string" || id.length === 0) return null;
  return id;
}

export const PaidSocialCreateBodySchema = z
  .object({
    campaignId: z.string().uuid(),
    provider: z.enum(["meta_ads"]),
    internalName: z.string().min(1).max(200).optional(),
  })
  .strict();

export const PaidSocialPlacementSchema = z.enum([
  "facebook_feed",
  "instagram_feed",
  "instagram_reels",
  "facebook_reels",
  "instagram_stories",
  "facebook_stories",
]);

export const PaidSocialPatchBodySchema = z
  .object({
    internalName: z.string().min(1).max(200).optional(),
    adSetName: z.string().max(200).nullable().optional(),
    adName: z.string().max(200).nullable().optional(),
    objective: z.enum(["awareness", "traffic", "engagement", "leads", "conversions", ""]).optional(),
    draftStatus: z.enum(["draft", "archived"]).optional(),
    budgetType: z.enum(["none", "daily", "lifetime"]).optional(),
    budgetAmountMinor: z.number().int().min(0).nullable().optional(),
    currency: z.string().min(3).max(8).optional(),
    startAt: z.string().datetime().nullable().optional(),
    endAt: z.string().datetime().nullable().optional(),
    destinationUrl: z.string().max(1024).nullable().optional(),
    ctaLabel: z.string().max(120).nullable().optional(),
    leadFormPlaceholder: z.string().max(512).nullable().optional(),
    audience: z
      .object({
        geography: z.string().max(500).optional(),
        ageMin: z.number().int().min(13).max(120).optional(),
        ageMax: z.number().int().min(13).max(120).optional(),
        interestsNotes: z.string().max(2000).optional(),
        customAudiencePlaceholder: z.string().max(500).optional(),
      })
      .strict()
      .optional(),
    placements: z.array(PaidSocialPlacementSchema).max(12).optional(),
    creative: z
      .object({
        primaryAssetIds: z.array(z.string().uuid()).max(8).optional(),
        referenceOrganicPostId: z.string().uuid().nullable().optional(),
        notes: z.string().max(2000).optional(),
      })
      .strict()
      .optional(),
    metaAdAccountId: z.string().max(64).nullable().optional(),
    metaPageId: z.string().max(64).nullable().optional(),
    metaFacebookSocialAccountId: z.string().uuid().nullable().optional(),
  })
  .strict();

export type PaidSocialPatchBody = z.infer<typeof PaidSocialPatchBodySchema>;

export function parseJsonAudience(row: CampaignPaidSocialCampaignRow): PaidSocialAudienceSummary {
  const j = row.audienceJson;
  if (!j || typeof j !== "object") return {};
  return j as PaidSocialAudienceSummary;
}

export function parseJsonPlacements(row: CampaignPaidSocialCampaignRow): string[] {
  const j = row.placementsJson;
  if (!Array.isArray(j)) return [];
  return j.filter((x): x is string => typeof x === "string");
}

export function parseJsonCreative(row: CampaignPaidSocialCampaignRow): PaidSocialCreativeConfig {
  const j = row.creativeConfigJson;
  if (!j || typeof j !== "object") return {};
  return j as PaidSocialCreativeConfig;
}

/** Stable organic post id for duplicate detection / projection (matches API `referenceCampaignPostId`). */
export function canonicalReferencedOrganicPostIdFromPaidRow(row: CampaignPaidSocialCampaignRow): string | null {
  const viaCfg = parseJsonCreative(row).referenceOrganicPostId;
  if (typeof viaCfg === "string" && viaCfg.trim().length > 0) return viaCfg.trim();
  return referencedOrganicPostIdFromCreativeConfigJson(row.creativeConfigJson);
}

/**
 * First non-archived paid draft in the campaign whose creative references `organicPostId` (Part 60).
 */
export async function findNonArchivedPaidDraftReferencingOrganicPost(
  db: Db,
  campaignId: string,
  organicPostId: string
): Promise<CampaignPaidSocialCampaignRow | null> {
  const rows = await listPaidSocialCampaignsByCampaign(db, campaignId);
  for (const row of rows) {
    if (String(row.draftStatus ?? "").toLowerCase() === "archived") continue;
    const ref = canonicalReferencedOrganicPostIdFromPaidRow(row);
    if (ref === organicPostId) return row;
  }
  return null;
}

export type OrganicPromotionExistingPaidProjection = {
  exists: boolean;
  paidCampaignId: string;
  status: string;
  name?: string;
  paidCreativeSource?: "organic_post" | "manual";
};

export function existingPaidPromotionProjectionFromRow(
  row: CampaignPaidSocialCampaignRow | null
): OrganicPromotionExistingPaidProjection {
  if (!row) {
    return { exists: false, paidCampaignId: "", status: "" };
  }
  return {
    exists: true,
    paidCampaignId: row.id,
    status: row.draftStatus ?? "draft",
    name: row.internalName,
    paidCreativeSource: canonicalReferencedOrganicPostIdFromPaidRow(row) ? "organic_post" : "manual",
  };
}

function metaExecutionInputFromRow(
  row: CampaignPaidSocialCampaignRow,
  assetHint: { creativeType: string | null; hasStorageUrl: boolean }
): PaidSocialMetaExecutionReadinessInput {
  return {
    metaAdAccountId: row.metaAdAccountId ?? null,
    metaPageId: row.metaPageId ?? null,
    metaLaunchStatus: row.metaLaunchStatus ?? "idle",
    remoteMetaCampaignId: row.remoteMetaCampaignId ?? null,
    primaryAssetCreativeType: assetHint.creativeType,
    primaryAssetHasPublicImageUrl: assetHint.hasStorageUrl,
  };
}

export function buildReadinessForPaidSocialRow(
  row: CampaignPaidSocialCampaignRow,
  assetHint: { creativeType: string | null; hasStorageUrl: boolean }
) {
  return derivePaidSocialCampaignReadiness({
    provider: row.provider,
    objective: row.objective,
    budgetType: row.budgetType,
    budgetAmountMinor: row.budgetAmountMinor,
    destinationUrl: row.destinationUrl,
    placements: parseJsonPlacements(row),
    creative: parseJsonCreative(row),
    metaExecution: metaExecutionInputFromRow(row, assetHint),
  });
}

export async function loadPrimaryAssetHintsForPaidSocialRows(
  db: Db,
  campaignId: string,
  rows: CampaignPaidSocialCampaignRow[]
): Promise<Map<string, { creativeType: string | null; hasStorageUrl: boolean }>> {
  const hintMap = new Map<string, { creativeType: string | null; hasStorageUrl: boolean }>();
  const paidToAsset = new Map<string, string>();
  const assetIds: string[] = [];
  for (const row of rows) {
    hintMap.set(row.id, { creativeType: null, hasStorageUrl: false });
    const cr = parseJsonCreative(row);
    const first = cr.primaryAssetIds?.[0];
    if (first) {
      paidToAsset.set(row.id, first);
      assetIds.push(first);
    }
  }
  if (assetIds.length === 0) return hintMap;
  const uniq = Array.from(new Set(assetIds));
  const assetRows = await db
    .select({
      id: campaignAssets.id,
      creativeType: campaignAssets.creativeType,
      storageUrl: campaignAssets.storageUrl,
    })
    .from(campaignAssets)
    .where(and(eq(campaignAssets.campaignId, campaignId), inArray(campaignAssets.id, uniq)));
  type AssetHintRow = (typeof assetRows)[number];
  const byId = new Map<string, AssetHintRow>(assetRows.map((r: AssetHintRow) => [r.id, r]));
  for (const [paidId, aid] of paidToAsset) {
    const ar = byId.get(aid);
    hintMap.set(paidId, {
      creativeType: ar?.creativeType ? String(ar.creativeType) : null,
      hasStorageUrl: Boolean(ar?.storageUrl?.trim()),
    });
  }
  return hintMap;
}

export type ProjectPaidSocialCampaignPublicOptions = {
  /** Precomputed asset hint (list path — avoids per-row asset query). */
  assetHint?: { creativeType: string | null; hasStorageUrl: boolean };
  /**
   * Batch cooldown projections keyed by `normalizePaidSyncAccountKey(metaAdAccountId)` (list path — one backoff query).
   */
  metaAdsCooldownByAccountKey?: Map<string, PaidSyncCooldownProjection>;
  /** Shared `now` for cooldown projection when batching (optional). */
  cooldownNow?: Date;
  /**
   * When present and `has(row.id)`, uses preloaded latest snapshot instead of querying per row (list path).
   */
  latestSnapshotByPaidCampaignId?: Map<string, PaidSocialAnalyticsSnapshotRow | null>;
  /**
   * Latest organic normalized metrics for `creative.referenceOrganicPostId` keys (list path — Part 59).
   */
  referencePostMetricsByPostId?: Map<string, NormalizedSocialPostMetrics | null>;
  /** Latest organic analytics `fetched_at` per referenced post id (list path — Part 62). */
  referencePostSnapshotFetchedAtByPostId?: Map<string, Date | null>;
  /** `campaign_posts.posted_at` per referenced post id (list path — Part 62). */
  referencePostPublishedAtByPostId?: Map<string, Date | null>;
  /** Override clock for cross-surface comparison readiness (tests). */
  comparisonNow?: Date;
};

export async function projectPaidSocialCampaignPublic(
  db: Db,
  row: CampaignPaidSocialCampaignRow,
  campaignId: string,
  options?: ProjectPaidSocialCampaignPublicOptions
) {
  let hint: { creativeType: string | null; hasStorageUrl: boolean };
  if (options?.assetHint) {
    hint = options.assetHint;
  } else {
    const hintsMap = await loadPrimaryAssetHintsForPaidSocialRows(db, campaignId, [row]);
    hint = hintsMap.get(row.id) ?? { creativeType: null, hasStorageUrl: false };
  }
  const readiness = buildReadinessForPaidSocialRow(row, hint);
  const paidLaunchLifecycle = derivePaidLaunchLifecycle({
    metaLaunchStatus: row.metaLaunchStatus ?? "idle",
    remoteMetaCampaignId: row.remoteMetaCampaignId ?? null,
    structurallyComplete: readiness.structurallyComplete,
  });

  let latestSnap: PaidSocialAnalyticsSnapshotRow | null;
  if (options?.latestSnapshotByPaidCampaignId?.has(row.id)) {
    latestSnap = options.latestSnapshotByPaidCampaignId.get(row.id) ?? null;
  } else {
    latestSnap = await getLatestPaidSocialAnalyticsSnapshot(db, row.id);
  }
  let latestPaidMetrics: PaidSocialNormalizedMetrics | null = null;
  let latestSnapshotMeta: {
    metricsCompleteness?: string;
    sourceNotes?: string[];
    insightsSource?: string | null;
    usedFallbackInsights?: boolean;
  } | null = null;

  if (row.lastMetaStatusJson && typeof row.lastMetaStatusJson === "object") {
    const s = row.lastMetaStatusJson as Record<string, unknown>;
    if (typeof s.metricsCompleteness === "string" || Array.isArray(s.sourceNotes) || typeof s.insightsSource === "string") {
      latestSnapshotMeta = {
        metricsCompleteness: typeof s.metricsCompleteness === "string" ? s.metricsCompleteness : undefined,
        sourceNotes: Array.isArray(s.sourceNotes)
          ? (s.sourceNotes as unknown[]).filter((x): x is string => typeof x === "string")
          : undefined,
        insightsSource: typeof s.insightsSource === "string" ? s.insightsSource : null,
      };
    }
  }

  if (latestSnap?.metricsJson && typeof latestSnap.metricsJson === "object") {
    const mj = latestSnap.metricsJson as Record<string, unknown>;
    const n = mj.normalized;
    if (n && typeof n === "object") {
      latestPaidMetrics = n as PaidSocialNormalizedMetrics;
    }
    const meta = mj.meta;
    if (meta && typeof meta === "object") {
      const m = meta as Record<string, unknown>;
      latestSnapshotMeta = {
        ...latestSnapshotMeta,
        metricsCompleteness: typeof m.metricsCompleteness === "string" ? m.metricsCompleteness : latestSnapshotMeta?.metricsCompleteness,
        sourceNotes: Array.isArray(m.sourceNotes)
          ? (m.sourceNotes as unknown[]).filter((x): x is string => typeof x === "string")
          : latestSnapshotMeta?.sourceNotes,
        insightsSource: typeof m.insightsSource === "string" ? m.insightsSource : latestSnapshotMeta?.insightsSource ?? null,
        usedFallbackInsights: typeof m.usedFallbackInsights === "boolean" ? m.usedFallbackInsights : latestSnapshotMeta?.usedFallbackInsights,
      };
    }
  }

  const paidSyncHealth: PaidSyncHealth = derivePaidSyncHealth({
    metaLaunchFeatureEnabled: isMetaAdsLaunchFeatureEnabled(),
    paidLaunchLifecycle,
    remoteMetaCampaignId: row.remoteMetaCampaignId ?? null,
    lastMetaSyncAt: row.lastMetaSyncAt ? new Date(row.lastMetaSyncAt as Date).toISOString() : null,
    lastMetaSyncError: row.lastMetaSyncErrorJson ?? null,
    metaRuntimeStatus: row.metaRuntimeStatus ?? null,
    latestPaidMetrics,
    latestSnapshotMeta,
  });

  const paidStructuredSyncError: PaidStructuredSyncErrorProjection | null = projectPaidStructuredSyncError(
    row.lastMetaSyncErrorJson ?? null
  );

  let paidSyncCooldown: PaidSyncCooldownProjection = {
    syncCooldownActive: false,
    syncCooldownUntil: null,
    syncCooldownReason: null,
    syncCooldownLabel: null,
    syncCooldownHint: null,
  };
  if (isMetaAdsLaunchFeatureEnabled() && row.provider === "meta_ads") {
    const acct = normalizePaidSyncAccountKey(row.metaAdAccountId);
    const now = options?.cooldownNow ?? new Date();
    if (options?.metaAdsCooldownByAccountKey?.has(acct)) {
      paidSyncCooldown = options.metaAdsCooldownByAccountKey.get(acct)!;
    } else {
      const backoffRow = await reloadPaidSyncBackoffRow(db, PAID_SYNC_PROVIDER_META_ADS, acct);
      paidSyncCooldown = projectPaidSyncCooldownFromBackoffRow(backoffRow, now);
    }
  }

  const paidOptimizationSignals: PaidOptimizationSignal[] = derivePaidOptimizationSignals({
    paidLaunchLifecycle,
    metaLaunchStatus: row.metaLaunchStatus ?? undefined,
    remoteMetaCampaignId: row.remoteMetaCampaignId ?? null,
    lastMetaSyncAt: row.lastMetaSyncAt ? new Date(row.lastMetaSyncAt as Date).toISOString() : null,
    metaRuntimeStatus: row.metaRuntimeStatus ?? null,
    latestPaidMetrics,
  });

  const referenceCampaignPostId = canonicalReferencedOrganicPostIdFromPaidRow(row);
  const paidCreativeSource: "organic_post" | "manual" = referenceCampaignPostId ? "organic_post" : "manual";

  let crossSurfaceSignals: CrossSurfaceAnalyticsSignal[] = [];
  let crossSurfacePromotionOutcomes: CrossSurfacePromotionOutcomes | undefined;
  let crossSurfaceComparisonReadiness: CrossSurfaceComparisonReadiness | undefined;
  if (referenceCampaignPostId) {
    let orgNormalized: NormalizedSocialPostMetrics | null | undefined =
      options?.referencePostMetricsByPostId?.get(referenceCampaignPostId);
    let organicSnapshotFetchedAt: Date | string | null | undefined =
      options?.referencePostSnapshotFetchedAtByPostId?.get(referenceCampaignPostId);

    if (orgNormalized === undefined || organicSnapshotFetchedAt === undefined) {
      const m = await getLatestAnalyticsSnapshotRowsForPostIds(db, [referenceCampaignPostId]);
      const snap = m.get(referenceCampaignPostId);
      if (orgNormalized === undefined) {
        orgNormalized = snap ? parseStoredAnalyticsPayload(snap.metricsJson)?.normalized ?? null : null;
      }
      if (organicSnapshotFetchedAt === undefined) {
        organicSnapshotFetchedAt = snap?.fetchedAt ?? null;
      }
    }

    let postPublishedAt: Date | string | null | undefined = options?.referencePostPublishedAtByPostId?.get(
      referenceCampaignPostId
    );
    if (postPublishedAt === undefined) {
      const pr = await db
        .select({ postedAt: campaignPosts.postedAt })
        .from(campaignPosts)
        .where(eq(campaignPosts.id, referenceCampaignPostId))
        .limit(1);
      postPublishedAt = pr[0]?.postedAt ?? null;
    }

    crossSurfaceComparisonReadiness = deriveCrossSurfaceComparisonReadiness({
      now: options?.comparisonNow,
      organicLatestFetchedAt: organicSnapshotFetchedAt ?? null,
      paidLatestFetchedAt: latestSnap?.fetchedAt ?? null,
      postPublishedAt: postPublishedAt ?? null,
      paidCreatedAt: row.createdAt,
      paidLaunchedAt: row.launchedAt ?? null,
    });

    if (orgNormalized) {
      const organicPromotion = deriveOrganicPerformanceSignals(orgNormalized);
      crossSurfaceSignals = deriveCrossSurfaceAnalyticsSignals({
        organicMetrics: orgNormalized,
        paidMetrics: latestPaidMetrics,
        organicPromotion,
      });
      if (crossSurfaceComparisonReadiness.comparable) {
        if (!meetsCrossSurfacePromotionMinimumSample(orgNormalized, latestPaidMetrics)) {
          crossSurfaceComparisonReadiness = { comparable: false, reason: "insufficient_sample" };
        } else {
          const promotionOutcomes = deriveCrossSurfacePromotionOutcomes({
            organicMetrics: orgNormalized,
            paidMetrics: latestPaidMetrics,
          });
          if (
            promotionOutcomes != null &&
            (promotionOutcomes.promotionEffective || promotionOutcomes.promotionInefficient)
          ) {
            crossSurfacePromotionOutcomes = promotionOutcomes;
          }
        }
      }
    }
  }

  return {
    id: row.id,
    campaignId: row.campaignId,
    provider: row.provider,
    internalName: row.internalName,
    adSetName: row.adSetName,
    adName: row.adName,
    objective: row.objective,
    draftStatus: row.draftStatus,
    budgetType: row.budgetType,
    budgetAmountMinor: row.budgetAmountMinor,
    currency: row.currency,
    startAt: row.startAt ? new Date(row.startAt as Date).toISOString() : null,
    endAt: row.endAt ? new Date(row.endAt as Date).toISOString() : null,
    destinationUrl: row.destinationUrl,
    ctaLabel: row.ctaLabel,
    leadFormPlaceholder: row.leadFormPlaceholder,
    audience: parseJsonAudience(row),
    placements: parseJsonPlacements(row),
    creative: parseJsonCreative(row),
    readiness,
    metaLaunchFeatureEnabled: isMetaAdsLaunchFeatureEnabled(),
    metaAdAccountId: row.metaAdAccountId ?? null,
    metaPageId: row.metaPageId ?? null,
    metaFacebookSocialAccountId: row.metaFacebookSocialAccountId ?? null,
    metaLaunchStatus: row.metaLaunchStatus ?? "idle",
    remoteMetaCampaignId: row.remoteMetaCampaignId ?? null,
    remoteMetaAdsetId: row.remoteMetaAdsetId ?? null,
    remoteMetaCreativeId: row.remoteMetaCreativeId ?? null,
    remoteMetaAdId: row.remoteMetaAdId ?? null,
    lastLaunchError: row.lastLaunchErrorJson ?? null,
    launchedAt: row.launchedAt ? new Date(row.launchedAt as Date).toISOString() : null,
    lastMetaSyncAt: row.lastMetaSyncAt ? new Date(row.lastMetaSyncAt as Date).toISOString() : null,
    paidLaunchLifecycle,
    metaRuntimeStatus: row.metaRuntimeStatus ?? null,
    lastMetaSyncError: row.lastMetaSyncErrorJson ?? null,
    latestPaidMetrics,
    latestPaidMetricsFetchedAt: latestSnap?.fetchedAt
      ? new Date(latestSnap.fetchedAt as Date).toISOString()
      : null,
    latestSnapshotMeta,
    paidSyncHealth,
    paidStructuredSyncError,
    syncCooldownActive: paidSyncCooldown.syncCooldownActive,
    syncCooldownUntil: paidSyncCooldown.syncCooldownUntil,
    syncCooldownReason: paidSyncCooldown.syncCooldownReason,
    syncCooldownLabel: paidSyncCooldown.syncCooldownLabel,
    syncCooldownHint: paidSyncCooldown.syncCooldownHint,
    paidOptimizationSignals,
    referenceCampaignPostId,
    paidCreativeSource,
    crossSurfaceSignals,
    crossSurfacePromotionOutcomes,
    crossSurfaceComparisonReadiness,
    createdAt: row.createdAt ? new Date(row.createdAt as Date).toISOString() : null,
    updatedAt: row.updatedAt ? new Date(row.updatedAt as Date).toISOString() : null,
  };
}

export type PaidSocialCampaignPublic = Awaited<ReturnType<typeof projectPaidSocialCampaignPublic>>;

export type PromotionDecisionSummaryTopStatus =
  | "promotion_effective"
  | "promotion_inefficient"
  | "comparison_not_ready"
  | "mixed";

/** Part 65: bucket counts for organic-linked rows that are not comparable (readiness.comparable === false). */
export type PromotionNonComparableReasonCounts = Partial<
  Record<CrossSurfaceComparisonReadinessReason, number>
>;

/**
 * Part 66: machine-readable campaign-level explainability (omitted when it adds no value).
 * `no_linked_organic_drafts` is reserved for clients; list GET still omits the whole summary when `referencedOrganicCount === 0`.
 */
export type PromotionDecisionExplainabilityStatus =
  | "ready"
  | "insufficient_comparable_rows"
  | "no_linked_organic_drafts";

/** Part 66: unique max from `nonComparableReasonCounts`; omitted on ties or missing counts. */
export type PromotionDecisionDominantNonComparableReason = CrossSurfaceComparisonReadinessReason;

function pickDominantNonComparableReason(
  counts: PromotionNonComparableReasonCounts | undefined
): PromotionDecisionDominantNonComparableReason | undefined {
  if (!counts || Object.keys(counts).length === 0) return undefined;
  const pairs = Object.entries(counts).filter(
    (e): e is [CrossSurfaceComparisonReadinessReason, number] =>
      typeof e[1] === "number" && e[1] > 0
  );
  if (pairs.length === 0) return undefined;
  const max = Math.max(...pairs.map(([, n]) => n));
  const atMax = pairs.filter(([, n]) => n === max);
  if (atMax.length !== 1) return undefined;
  return atMax[0][0];
}

/** Part 63: campaign-level rollup over already-projected paid rows (deterministic; no extra queries). */
export type PromotionDecisionSummary = {
  referencedOrganicCount: number;
  comparableCount: number;
  effectiveCount: number;
  inefficientCount: number;
  notReadyCount: number;
  /** Present only when at least one non-comparable row has a known `reason`. */
  nonComparableReasonCounts?: PromotionNonComparableReasonCounts;
  topStatusLabel?: PromotionDecisionSummaryTopStatus;
  explainabilityStatus?: PromotionDecisionExplainabilityStatus;
  dominantNonComparableReason?: PromotionDecisionDominantNonComparableReason;
  /** Part 67: present only when `topStatusLabel` is set. */
  topStatusLabelText?: string;
  /** Part 67: present only when `dominantNonComparableReason` is set. */
  dominantNonComparableReasonText?: string;
  /** Part 67: present only for `insufficient_comparable_rows`. */
  explainabilityStatusText?: string;
};

/** Part 67: stable copy for campaign rollup label (shared with API + clients). */
export function promotionDecisionTopStatusLabelText(label: PromotionDecisionSummaryTopStatus): string {
  switch (label) {
    case "promotion_effective":
      return "Promotions are generally outperforming original organic posts";
    case "promotion_inefficient":
      return "Promotions are generally underperforming original organic posts";
    case "mixed":
      return "Promotion results are mixed";
    case "comparison_not_ready":
      return "Promotion comparisons are not ready yet";
    default:
      return "";
  }
}

/** Part 67: stable copy for dominant non-comparable readiness reason. */
export function promotionDecisionDominantReasonText(
  reason: PromotionDecisionDominantNonComparableReason
): string {
  switch (reason) {
    case "missing_timestamps":
      return "Some linked drafts are missing comparison timestamps.";
    case "window_too_early":
      return "Some linked drafts are still too new to compare.";
    case "stale_organic":
      return "Some linked drafts need fresher organic performance data.";
    case "stale_paid":
      return "Some linked drafts need fresher paid performance data.";
    case "insufficient_overlap":
      return "Some linked drafts do not have an aligned comparison window.";
    case "insufficient_sample":
      return "Most pending comparisons need more data.";
    default:
      return "";
  }
}

/**
 * Part 67: optional human-readable explainability; omits `ready` (and unused codes) to keep payload light.
 */
export function promotionDecisionExplainabilityStatusText(
  status: PromotionDecisionExplainabilityStatus
): string | undefined {
  switch (status) {
    case "insufficient_comparable_rows":
      return "Need at least 2 comparable linked drafts for a campaign-level promotion summary.";
    default:
      return undefined;
  }
}

/**
 * Part 63: aggregate organic-linked promotion outcomes for the paid list projection.
 * Returns `undefined` when no paid drafts reference an organic post (omit from API).
 */
export function computePromotionDecisionSummaryForCampaign(
  paidCampaigns: PaidSocialCampaignPublic[]
): PromotionDecisionSummary | undefined {
  let referencedOrganicCount = 0;
  let comparableCount = 0;
  let effectiveCount = 0;
  let inefficientCount = 0;
  let notReadyCount = 0;
  const reasonScratch: Partial<Record<CrossSurfaceComparisonReadinessReason, number>> = {};

  for (const p of paidCampaigns) {
    if (!p.referenceCampaignPostId) continue;
    referencedOrganicCount += 1;

    const readiness = p.crossSurfaceComparisonReadiness;
    if (readiness?.comparable === true) {
      comparableCount += 1;
    } else {
      notReadyCount += 1;
      const r = readiness?.reason;
      if (r) {
        reasonScratch[r] = (reasonScratch[r] ?? 0) + 1;
      }
    }

    const outcomes = p.crossSurfacePromotionOutcomes;
    if (outcomes?.promotionEffective === true) effectiveCount += 1;
    if (outcomes?.promotionInefficient === true) inefficientCount += 1;
  }

  if (referencedOrganicCount === 0) return undefined;

  const nonComparableReasonCounts: PromotionNonComparableReasonCounts | undefined =
    Object.keys(reasonScratch).length > 0
      ? (Object.fromEntries(
          Object.entries(reasonScratch).filter(
            (e): e is [CrossSurfaceComparisonReadinessReason, number] =>
              typeof e[1] === "number" && e[1] > 0
          )
        ) as PromotionNonComparableReasonCounts)
      : undefined;

  /** Part 64: campaign rollup language only when at least two linked drafts are comparable. */
  let topStatusLabel: PromotionDecisionSummaryTopStatus | undefined;
  if (comparableCount >= 2) {
    if (effectiveCount > 0 && inefficientCount > 0) {
      topStatusLabel = "mixed";
    } else if (effectiveCount > 0) {
      topStatusLabel = "promotion_effective";
    } else if (inefficientCount > 0) {
      topStatusLabel = "promotion_inefficient";
    }
  }

  const dominantNonComparableReason = pickDominantNonComparableReason(nonComparableReasonCounts);

  let explainabilityStatus: PromotionDecisionExplainabilityStatus | undefined;
  if (topStatusLabel) {
    explainabilityStatus = "ready";
  } else if (referencedOrganicCount > 0 && comparableCount < 2) {
    explainabilityStatus = "insufficient_comparable_rows";
  }

  const explainabilityStatusText = explainabilityStatus
    ? promotionDecisionExplainabilityStatusText(explainabilityStatus)
    : undefined;

  return {
    referencedOrganicCount,
    comparableCount,
    effectiveCount,
    inefficientCount,
    notReadyCount,
    ...(nonComparableReasonCounts ? { nonComparableReasonCounts } : {}),
    ...(topStatusLabel
      ? {
          topStatusLabel,
          topStatusLabelText: promotionDecisionTopStatusLabelText(topStatusLabel),
        }
      : {}),
    ...(explainabilityStatus ? { explainabilityStatus } : {}),
    ...(explainabilityStatusText ? { explainabilityStatusText } : {}),
    ...(dominantNonComparableReason
      ? {
          dominantNonComparableReason,
          dominantNonComparableReasonText: promotionDecisionDominantReasonText(dominantNonComparableReason),
        }
      : {}),
  };
}

/**
 * List projection: one backoff query, one latest-snapshot query for all drafts, one asset-hint query (Parts 54–55).
 */
export async function projectPaidSocialCampaignsPublicForList(
  db: Db,
  rows: CampaignPaidSocialCampaignRow[],
  campaignId: string
): Promise<PaidSocialCampaignPublic[]> {
  if (rows.length === 0) return [];

  const t0 = Date.now();
  const hintsMap = await loadPrimaryAssetHintsForPaidSocialRows(db, campaignId, rows);
  const snapBatch = await getLatestPaidSocialAnalyticsSnapshotsForPaidCampaignIds(db, rows.map((r) => r.id));
  const latestSnapshotByPaidCampaignId = snapBatch.byPaidCampaignId;

  const refOrganicIds = [
    ...new Set(
      rows
        .map((r) => parseJsonCreative(r).referenceOrganicPostId)
        .filter((x): x is string => typeof x === "string" && x.length > 0)
    ),
  ];
  const refLatest =
    refOrganicIds.length > 0 ? await getLatestAnalyticsSnapshotRowsForPostIds(db, refOrganicIds) : new Map();
  const referencePostMetricsByPostId = new Map<string, NormalizedSocialPostMetrics | null>();
  const referencePostSnapshotFetchedAtByPostId = new Map<string, Date | null>();
  for (const rid of refOrganicIds) {
    const s = refLatest.get(rid);
    referencePostMetricsByPostId.set(rid, s ? parseStoredAnalyticsPayload(s.metricsJson)?.normalized ?? null : null);
    referencePostSnapshotFetchedAtByPostId.set(rid, s?.fetchedAt ? new Date(s.fetchedAt as Date) : null);
  }

  const referencePostPublishedAtByPostId = new Map<string, Date | null>();
  if (refOrganicIds.length > 0) {
    const postRows = await db
      .select({ id: campaignPosts.id, postedAt: campaignPosts.postedAt })
      .from(campaignPosts)
      .where(inArray(campaignPosts.id, refOrganicIds));
    for (const pr of postRows) {
      referencePostPublishedAtByPostId.set(pr.id, pr.postedAt ? new Date(pr.postedAt as Date) : null);
    }
  }

  const cooldownNow = new Date();
  const metaKeys = rows.filter((r) => r.provider === "meta_ads").map((r) => normalizePaidSyncAccountKey(r.metaAdAccountId));
  let metaAdsCooldownByAccountKey: Map<string, PaidSyncCooldownProjection> | undefined;
  if (isMetaAdsLaunchFeatureEnabled()) {
    metaAdsCooldownByAccountKey = await loadPaidSyncCooldownProjectionsForAccountKeys(
      db,
      PAID_SYNC_PROVIDER_META_ADS,
      metaKeys,
      cooldownNow
    );
  }

  const projected = await Promise.all(
    rows.map((r) =>
      projectPaidSocialCampaignPublic(db, r, campaignId, {
        assetHint: hintsMap.get(r.id) ?? { creativeType: null, hasStorageUrl: false },
        metaAdsCooldownByAccountKey,
        latestSnapshotByPaidCampaignId,
        referencePostMetricsByPostId,
        referencePostSnapshotFetchedAtByPostId,
        referencePostPublishedAtByPostId,
        cooldownNow,
      })
    )
  );

  logPaidListProjection({
    snapshotQueryStrategy: snapBatch.snapshotQueryStrategy,
    paidCampaignCount: rows.length,
    snapshotRowsReturned: snapBatch.snapshotRowsReturned,
    cooldownDistinctAccountKeys: isMetaAdsLaunchFeatureEnabled() ? new Set(metaKeys).size : 0,
    durationMs: Date.now() - t0,
  });

  return projected;
}

async function insertPaidSocialAudit(
  db: Db,
  userId: number,
  action: "paid_social_campaign_created" | "paid_social_campaign_updated",
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

export async function listPaidSocialCampaignsByCampaign(
  db: Db,
  campaignId: string
): Promise<CampaignPaidSocialCampaignRow[]> {
  return db
    .select()
    .from(campaignPaidSocialCampaigns)
    .where(eq(campaignPaidSocialCampaigns.campaignId, campaignId))
    .orderBy(desc(campaignPaidSocialCampaigns.updatedAt))
    .limit(50);
}

export async function getPaidSocialCampaignById(db: Db, id: string): Promise<CampaignPaidSocialCampaignRow | null> {
  const rows = await db.select().from(campaignPaidSocialCampaigns).where(eq(campaignPaidSocialCampaigns.id, id)).limit(1);
  return rows[0] ?? null;
}

async function assertFacebookSocialAccountInCampaignScope(
  db: Db,
  campaignId: string,
  socialAccountId: string
): Promise<void> {
  const campRows = await db.select().from(campaigns).where(eq(campaigns.id, campaignId)).limit(1);
  const camp = campRows[0];
  if (!camp) throw new PaidSocialCampaignError("NOT_FOUND");
  const rows = await db
    .select({ id: socialAccounts.id })
    .from(socialAccounts)
    .where(
      and(
        eq(socialAccounts.id, socialAccountId),
        eq(socialAccounts.userId, camp.userId),
        eq(socialAccounts.clientId, camp.clientId),
        eq(socialAccounts.platform, "facebook")
      )
    )
    .limit(1);
  if (!rows[0]) throw new PaidSocialCampaignError("INVALID_FB_SOCIAL_ACCOUNT", "Facebook social account not in campaign scope.");
}

export async function createPaidSocialCampaignDraft(
  db: Db,
  args: { campaignId: string; userId: number; provider: string; internalName?: string }
): Promise<CampaignPaidSocialCampaignRow> {
  if (!isPaidSocialAdProvider(args.provider)) {
    throw new PaidSocialCampaignError("INVALID_PROVIDER");
  }
  const id = crypto.randomUUID();
  const name = (args.internalName ?? "Untitled paid campaign").slice(0, 200);
  const uid = String(args.userId);
  await db.insert(campaignPaidSocialCampaigns).values({
    id,
    campaignId: args.campaignId,
    provider: args.provider,
    internalName: name,
    objective: "",
    draftStatus: "draft",
    budgetType: "none",
    currency: "USD",
    metaLaunchStatus: "idle",
    createdByUserId: uid,
    updatedByUserId: uid,
  });
  const row = await getPaidSocialCampaignById(db, id);
  if (!row) throw new PaidSocialCampaignError("INSERT_FAILED");
  await insertPaidSocialAudit(db, args.userId, "paid_social_campaign_created", {
    paidCampaignId: id,
    campaignId: args.campaignId,
    provider: args.provider,
    internalName: name,
  });
  return row;
}

/**
 * Create a Meta ads **draft** from a published organic `campaign_posts` row (Part 59). Does not launch.
 */
export async function createPaidSocialCampaignDraftFromOrganicPost(
  db: Db,
  args: { campaignId: string; userId: number; postId: string }
): Promise<CampaignPaidSocialCampaignRow> {
  const postRows = await db
    .select()
    .from(campaignPosts)
    .where(and(eq(campaignPosts.id, args.postId), eq(campaignPosts.campaignId, args.campaignId)))
    .limit(1);
  const post = postRows[0];
  if (!post) {
    throw new PaidSocialCampaignError("POST_NOT_IN_CAMPAIGN");
  }
  if (String(post.status).toUpperCase() !== "POSTED") {
    throw new PaidSocialCampaignError("POST_NOT_POSTED", "Only published posts can be promoted to a paid draft.");
  }

  const existingRef = await findNonArchivedPaidDraftReferencingOrganicPost(db, args.campaignId, args.postId);
  if (existingRef) {
    throw new PaidSocialCampaignError(
      "DUPLICATE_REFERENCE_ORGANIC_POST",
      "A paid draft already references this organic post.",
      {
        existingCampaignId: args.campaignId,
        existingDraftId: existingRef.id,
        existingStatus: existingRef.draftStatus ?? "draft",
        existingName: existingRef.internalName,
        paidCreativeSource: "organic_post",
      }
    );
  }

  const caption = (post.caption ?? "").trim();
  const nameBase = caption.slice(0, 120) || `Post ${args.postId.slice(0, 8)}`;
  const internalName = `Promoted: ${nameBase}`.slice(0, 200);

  const creative: PaidSocialCreativeConfig = {
    referenceOrganicPostId: args.postId,
    notes: `Created from organic campaign post ${args.postId} (Part 59 promote flow).`,
  };
  if (post.assetId?.trim()) {
    await assertAssetInCampaign(db, args.campaignId, post.assetId);
    creative.primaryAssetIds = [post.assetId];
  }

  const id = crypto.randomUUID();
  const uid = String(args.userId);
  await db.insert(campaignPaidSocialCampaigns).values({
    id,
    campaignId: args.campaignId,
    provider: "meta_ads",
    internalName,
    objective: "",
    draftStatus: "draft",
    budgetType: "none",
    currency: "USD",
    metaLaunchStatus: "idle",
    destinationUrl: post.linkUrl?.trim() || null,
    creativeConfigJson: creative,
    createdByUserId: uid,
    updatedByUserId: uid,
  });

  const row = await getPaidSocialCampaignById(db, id);
  if (!row) throw new PaidSocialCampaignError("INSERT_FAILED");

  await insertPaidSocialAudit(db, args.userId, "paid_social_campaign_created", {
    paidCampaignId: id,
    campaignId: args.campaignId,
    provider: "meta_ads",
    internalName,
    source: "from_organic_post",
    referenceOrganicPostId: args.postId,
  });
  return row;
}

async function assertAssetInCampaign(db: Db, campaignId: string, assetId: string): Promise<void> {
  const r = await db
    .select({ id: campaignAssets.id })
    .from(campaignAssets)
    .where(and(eq(campaignAssets.id, assetId), eq(campaignAssets.campaignId, campaignId)))
    .limit(1);
  if (!r[0]) throw new PaidSocialCampaignError("ASSET_NOT_IN_CAMPAIGN");
}

async function assertPostInCampaign(db: Db, campaignId: string, postId: string): Promise<void> {
  const r = await db
    .select({ id: campaignPosts.id })
    .from(campaignPosts)
    .where(and(eq(campaignPosts.id, postId), eq(campaignPosts.campaignId, campaignId)))
    .limit(1);
  if (!r[0]) throw new PaidSocialCampaignError("POST_NOT_IN_CAMPAIGN");
}

export async function patchPaidSocialCampaign(
  db: Db,
  args: { id: string; campaignId: string; userId: number; patch: PaidSocialPatchBody }
): Promise<CampaignPaidSocialCampaignRow> {
  const existing = await getPaidSocialCampaignById(db, args.id);
  if (!existing || existing.campaignId !== args.campaignId) {
    throw new PaidSocialCampaignError("NOT_FOUND");
  }

  const p = args.patch;
  const changed: string[] = [];

  const setPayload: Record<string, unknown> = {};

  if (p.internalName !== undefined) {
    setPayload.internalName = p.internalName;
    changed.push("internalName");
  }
  if (p.adSetName !== undefined) {
    setPayload.adSetName = p.adSetName;
    changed.push("adSetName");
  }
  if (p.adName !== undefined) {
    setPayload.adName = p.adName;
    changed.push("adName");
  }
  if (p.objective !== undefined) {
    setPayload.objective = p.objective;
    changed.push("objective");
  }
  if (p.draftStatus !== undefined) {
    setPayload.draftStatus = p.draftStatus;
    changed.push("draftStatus");
  }
  if (p.budgetType !== undefined) {
    setPayload.budgetType = p.budgetType;
    changed.push("budgetType");
  }
  if (p.budgetAmountMinor !== undefined) {
    setPayload.budgetAmountMinor = p.budgetAmountMinor;
    changed.push("budgetAmountMinor");
  }
  if (p.currency !== undefined) {
    setPayload.currency = p.currency;
    changed.push("currency");
  }
  if (p.startAt !== undefined) {
    setPayload.startAt = p.startAt ? new Date(p.startAt) : null;
    changed.push("startAt");
  }
  if (p.endAt !== undefined) {
    setPayload.endAt = p.endAt ? new Date(p.endAt) : null;
    changed.push("endAt");
  }
  if (p.destinationUrl !== undefined) {
    setPayload.destinationUrl = p.destinationUrl?.trim() || null;
    changed.push("destinationUrl");
  }
  if (p.ctaLabel !== undefined) {
    setPayload.ctaLabel = p.ctaLabel?.trim() || null;
    changed.push("ctaLabel");
  }
  if (p.leadFormPlaceholder !== undefined) {
    setPayload.leadFormPlaceholder = p.leadFormPlaceholder?.trim() || null;
    changed.push("leadFormPlaceholder");
  }

  if (p.audience !== undefined) {
    setPayload.audienceJson = p.audience;
    changed.push("audience");
  }
  if (p.placements !== undefined) {
    setPayload.placementsJson = p.placements;
    changed.push("placements");
  }

  if (p.creative !== undefined) {
    const cr = p.creative;
    for (const aid of cr.primaryAssetIds ?? []) {
      await assertAssetInCampaign(db, args.campaignId, aid);
    }
    if (cr.referenceOrganicPostId) {
      await assertPostInCampaign(db, args.campaignId, cr.referenceOrganicPostId);
    }
    const merged: PaidSocialCreativeConfig = {
      ...parseJsonCreative(existing),
      ...cr,
    };
    setPayload.creativeConfigJson = merged;
    changed.push("creative");
  }

  if (p.metaAdAccountId !== undefined) {
    setPayload.metaAdAccountId = p.metaAdAccountId?.trim() || null;
    changed.push("metaAdAccountId");
  }
  if (p.metaPageId !== undefined) {
    setPayload.metaPageId = p.metaPageId?.trim() || null;
    changed.push("metaPageId");
  }
  if (p.metaFacebookSocialAccountId !== undefined) {
    if (p.metaFacebookSocialAccountId) {
      await assertFacebookSocialAccountInCampaignScope(db, args.campaignId, p.metaFacebookSocialAccountId);
    }
    setPayload.metaFacebookSocialAccountId = p.metaFacebookSocialAccountId;
    changed.push("metaFacebookSocialAccountId");
  }

  if (changed.length === 0) {
    return existing;
  }

  setPayload.updatedByUserId = String(args.userId);

  await db.update(campaignPaidSocialCampaigns).set(setPayload).where(eq(campaignPaidSocialCampaigns.id, args.id));

  const next = await getPaidSocialCampaignById(db, args.id);
  if (!next) throw new PaidSocialCampaignError("NOT_FOUND");
  await insertPaidSocialAudit(db, args.userId, "paid_social_campaign_updated", {
    paidCampaignId: args.id,
    campaignId: args.campaignId,
    changedKeys: changed,
  });
  return next;
}
