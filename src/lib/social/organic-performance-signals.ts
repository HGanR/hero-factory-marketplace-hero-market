/**
 * Explainable organic post performance signals for promotion hints (Part 59).
 * Uses only normalized metrics already stored in analytics snapshots — no ML.
 */

import { eq } from "drizzle-orm";
import { campaignPosts } from "@/lib/db/schema";
import type { NormalizedSocialPostMetrics } from "@/lib/social/governed-post-analytics-types";
import { parseStoredAnalyticsPayload } from "@/lib/social/governed-post-analytics-normalize";
import { getLatestAnalyticsSnapshotRowsForPostIds } from "@/lib/social/governed-post-analytics-store";
import type { SocialPostTimelineDb } from "@/lib/social/social-post-audit-query";
import { normalizeCampaignPostPlatformForPublish } from "@/lib/social/platform-identity";
import { isGovernedSocialPublishPlatform } from "@/lib/social/social-governed-platforms";

/** Minimum impressions to flag “high reach” (absolute). */
export const ORGANIC_HIGH_IMPRESSIONS_THRESHOLD = 5_000;

/** Minimum composite engagement to flag “high engagement” (reactions+comments+shares or engagementsTotal). */
export const ORGANIC_HIGH_ENGAGEMENT_THRESHOLD = 120;

/** Post must exceed campaign average impressions by this factor (when average is known). */
export const ORGANIC_ABOVE_CAMPAIGN_AVG_RATIO = 1.35;

export type OrganicPerformanceSignal = {
  code: string;
  label: string;
  hint: string;
};

export type OrganicPerformanceSignalsResult = {
  signals: OrganicPerformanceSignal[];
  /** True when at least one signal suggests the post is worth offering “promote to ads”. */
  candidateForPromotion: boolean;
};

function finiteNumber(n: unknown): number | null {
  if (typeof n !== "number" || !Number.isFinite(n)) return null;
  return n;
}

function organicEngagementProxy(m: NormalizedSocialPostMetrics): number {
  const et = finiteNumber(m.engagementsTotal);
  if (et != null && et > 0) return et;
  const r = finiteNumber(m.reactions) ?? 0;
  const c = finiteNumber(m.comments) ?? 0;
  const s = finiteNumber(m.shares) ?? 0;
  return r + c + s;
}

/**
 * Derive signals from the latest normalized organic metrics for one post.
 */
export function deriveOrganicPerformanceSignals(
  metrics: NormalizedSocialPostMetrics,
  context?: { campaignAverageImpressions?: number | null }
): OrganicPerformanceSignalsResult {
  const signals: OrganicPerformanceSignal[] = [];
  const imp = finiteNumber(metrics.impressions);
  const eng = organicEngagementProxy(metrics);

  if (imp != null && imp >= ORGANIC_HIGH_IMPRESSIONS_THRESHOLD) {
    signals.push({
      code: "high_impressions",
      label: "High impressions",
      hint: `At least ${ORGANIC_HIGH_IMPRESSIONS_THRESHOLD.toLocaleString()} impressions in the latest snapshot — strong organic reach.`,
    });
  }

  if (eng >= ORGANIC_HIGH_ENGAGEMENT_THRESHOLD) {
    signals.push({
      code: "high_engagement",
      label: "High engagement",
      hint: `Engagement proxy ≥ ${ORGANIC_HIGH_ENGAGEMENT_THRESHOLD} (reactions, comments, shares, or platform engagement total).`,
    });
  }

  const avgImp = context?.campaignAverageImpressions;
  if (imp != null && avgImp != null && avgImp > 0 && imp >= avgImp * ORGANIC_ABOVE_CAMPAIGN_AVG_RATIO) {
    signals.push({
      code: "above_campaign_average",
      label: "Above campaign average",
      hint: `Impressions are ~${Math.round(ORGANIC_ABOVE_CAMPAIGN_AVG_RATIO * 100)}%+ of this campaign’s average among posts with impression data.`,
    });
  }

  const candidateForPromotion = signals.length > 0;

  return { signals, candidateForPromotion };
}

function isPostedStatus(st: string | null | undefined): boolean {
  return String(st ?? "").toUpperCase() === "POSTED";
}

export type OrganicPromotionOpportunitySummary = {
  topOrganicCandidateCount: number;
  /** Highest-priority label among candidates (stable ordering by signal code). */
  topSignalLabel: string | null;
};

/**
 * Campaign-level rollup: how many published governed posts look like promotion candidates.
 * Uses one latest-snapshot batch read + in-memory evaluation.
 */
export async function computeOrganicPromotionOpportunitySummaryForCampaign(
  db: SocialPostTimelineDb,
  campaignId: string
): Promise<OrganicPromotionOpportunitySummary> {
  const rows = await db
    .select({
      id: campaignPosts.id,
      status: campaignPosts.status,
      platform: campaignPosts.platform,
    })
    .from(campaignPosts)
    .where(eq(campaignPosts.campaignId, campaignId));

  const publishedIds = rows
    .filter((r) => {
      if (!isPostedStatus(r.status)) return false;
      const k = normalizeCampaignPostPlatformForPublish(r.platform);
      return k && isGovernedSocialPublishPlatform(k);
    })
    .map((r) => r.id);

  if (publishedIds.length === 0) {
    return { topOrganicCandidateCount: 0, topSignalLabel: null };
  }

  const latestMap = await getLatestAnalyticsSnapshotRowsForPostIds(db, publishedIds);

  let impSum = 0;
  let impPosts = 0;
  for (const row of latestMap.values()) {
    const payload = parseStoredAnalyticsPayload(row.metricsJson);
    const imp = finiteNumber(payload?.normalized.impressions);
    if (imp != null) {
      impSum += imp;
      impPosts += 1;
    }
  }
  const campaignAverageImpressions = impPosts > 0 ? impSum / impPosts : null;

  const candidateLabels: { code: string; label: string }[] = [];

  for (const postId of publishedIds) {
    const snap = latestMap.get(postId);
    if (!snap) continue;
    const payload = parseStoredAnalyticsPayload(snap.metricsJson);
    if (!payload) continue;
    const { signals, candidateForPromotion } = deriveOrganicPerformanceSignals(payload.normalized, {
      campaignAverageImpressions,
    });
    if (candidateForPromotion) {
      const sorted = [...signals].sort((a, b) => a.code.localeCompare(b.code));
      candidateLabels.push({ code: sorted[0]!.code, label: sorted[0]!.label });
    }
  }

  const topOrganicCandidateCount = candidateLabels.length;
  if (topOrganicCandidateCount === 0) {
    return { topOrganicCandidateCount: 0, topSignalLabel: null };
  }

  candidateLabels.sort((a, b) => a.code.localeCompare(b.code));
  return {
    topOrganicCandidateCount,
    topSignalLabel: candidateLabels[0]!.label,
  };
}
