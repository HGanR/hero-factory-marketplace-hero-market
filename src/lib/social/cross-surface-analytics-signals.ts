/**
 * Cross-surface (organic vs paid) analytics signals and comparison gates (Parts 59–64).
 * Pure functions over normalized metrics — no I/O.
 */

import type { NormalizedSocialPostMetrics } from "@/lib/social/governed-post-analytics-types";
import type { PaidSocialNormalizedMetrics } from "@/lib/social/paid-social-analytics-normalize";
import type { OrganicPerformanceSignalsResult } from "@/lib/social/organic-performance-signals";

export type CrossSurfaceAnalyticsSignal = {
  code: string;
  label: string;
  hint: string;
};

export type CrossSurfaceComparisonReadinessReason =
  | "missing_timestamps"
  | "window_too_early"
  | "stale_organic"
  | "stale_paid"
  | "insufficient_overlap"
  | "insufficient_sample";

export type CrossSurfaceComparisonReadiness =
  | { comparable: true }
  | { comparable: false; reason: CrossSurfaceComparisonReadinessReason };

export type CrossSurfacePromotionOutcomes = {
  promotionEffective: boolean;
  promotionInefficient: boolean;
  paidOutperformingOrganic: boolean;
};

const MS_DAY = 86_400_000;
const MS_HOUR = 3_600_000;

function num(v: unknown): number | null {
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  return v;
}

function toTimeMs(v: Date | string | null | undefined): number | null {
  if (v == null) return null;
  const t = v instanceof Date ? v.getTime() : new Date(v).getTime();
  return Number.isFinite(t) ? t : null;
}

export function meetsCrossSurfacePromotionMinimumSample(
  organicMetrics: NormalizedSocialPostMetrics,
  paidMetrics: PaidSocialNormalizedMetrics | null
): boolean {
  const pImp = num(paidMetrics?.impressions);
  if (pImp == null || pImp < 100) return false;
  const oImp = num(organicMetrics.impressions) ?? 0;
  const oEng = num(organicMetrics.engagementsTotal) ?? 0;
  if (oImp < 500 || oEng < 25) return false;
  return true;
}

export function deriveCrossSurfacePromotionOutcomes(input: {
  organicMetrics: NormalizedSocialPostMetrics;
  paidMetrics: PaidSocialNormalizedMetrics | null;
}): CrossSurfacePromotionOutcomes | null {
  const paid = input.paidMetrics;
  const pImp = num(paid?.impressions);
  if (pImp == null) return null;
  if (!meetsCrossSurfacePromotionMinimumSample(input.organicMetrics, paid)) return null;

  const oImp = num(input.organicMetrics.impressions) ?? 0;
  const oEng = num(input.organicMetrics.engagementsTotal) ?? 0;
  const pClicks = num(paid?.clicks) ?? 0;

  const paidRate = pImp > 0 ? pClicks / pImp : 0;
  const organicRate = oImp > 0 ? oEng / oImp : 0;

  const volumeEffective = oImp > 0 && pImp >= oImp * 1.5;
  const volumeInefficient = oImp > 0 && pImp < oImp * 0.75;
  const rateOutperforms = organicRate > 0 && paidRate >= organicRate * 1.5;

  const promotionEffective = volumeEffective || (rateOutperforms && pImp >= oImp * 0.5);
  const promotionInefficient = volumeInefficient && !promotionEffective;

  const paidOutperformingOrganic = promotionEffective && pImp >= oImp * 1.5;

  return {
    promotionEffective,
    promotionInefficient,
    paidOutperformingOrganic,
  };
}

export function deriveCrossSurfaceComparisonReadiness(input: {
  now?: Date;
  organicLatestFetchedAt: Date | string | null;
  paidLatestFetchedAt: Date | string | null;
  postPublishedAt: Date | string | null;
  paidCreatedAt: Date | string;
  paidLaunchedAt?: Date | string | null;
}): CrossSurfaceComparisonReadiness {
  const nowMs = toTimeMs(input.now ?? new Date());
  const orgMs = toTimeMs(input.organicLatestFetchedAt);
  const paidMs = toTimeMs(input.paidLatestFetchedAt);
  const postMs = toTimeMs(input.postPublishedAt);
  const createdMs = toTimeMs(input.paidCreatedAt);

  if (orgMs == null || paidMs == null || nowMs == null || createdMs == null) {
    return { comparable: false, reason: "missing_timestamps" };
  }

  const ageMs = nowMs - createdMs;
  if (ageMs < MS_DAY) {
    return { comparable: false, reason: "window_too_early" };
  }
  if (nowMs - paidMs < MS_DAY) {
    return { comparable: false, reason: "window_too_early" };
  }

  if (postMs != null) {
    const anchor = Math.max(postMs, createdMs);
    if (paidMs - orgMs > 3 * MS_DAY && paidMs > anchor + 7 * MS_DAY) {
      return { comparable: false, reason: "stale_organic" };
    }
  } else if (paidMs - orgMs > 3 * MS_DAY) {
    return { comparable: false, reason: "stale_organic" };
  }

  return { comparable: true };
}

function organicEngagementProxy(m: NormalizedSocialPostMetrics): number {
  const et = num(m.engagementsTotal);
  if (et != null && et > 0) return et;
  const r = num(m.reactions) ?? 0;
  const c = num(m.comments) ?? 0;
  const s = num(m.shares) ?? 0;
  return r + c + s;
}

export function deriveCrossSurfaceAnalyticsSignals(input: {
  organicMetrics: NormalizedSocialPostMetrics;
  paidMetrics: PaidSocialNormalizedMetrics | null;
  organicPromotion: OrganicPerformanceSignalsResult;
}): CrossSurfaceAnalyticsSignal[] {
  const out: CrossSurfaceAnalyticsSignal[] = [];
  const { organicMetrics, paidMetrics, organicPromotion } = input;

  if (paidMetrics == null) {
    if (organicPromotion.candidateForPromotion) {
      out.push({
        code: "organic_candidate_for_promotion",
        label: "Organic candidate",
        hint: "Paid metrics are not available yet; organic signals suggest this post may be worth promoting.",
      });
    }
    return out;
  }

  const oImp = num(organicMetrics.impressions) ?? 0;
  const pImp = num(paidMetrics.impressions) ?? 0;
  const oEng = organicEngagementProxy(organicMetrics);
  const pClicks = num(paidMetrics.clicks) ?? 0;

  if (pImp > 0 && oImp > 0 && oEng >= 400 && pClicks <= 5 && oImp >= pImp * 4) {
    out.push({
      code: "organic_outperforming_paid",
      label: "Organic outperforming paid",
      hint: "Organic delivery and engagement materially exceed paid delivery on comparable volume.",
    });
  }

  const ctr = num(paidMetrics.ctr);
  if (pImp >= 400 && ctr != null && ctr <= 0.001 && pClicks <= 2) {
    out.push({
      code: "paid_underperforming_baseline",
      label: "Paid underperforming",
      hint: "Paid CTR is very low relative to impressions in the latest snapshot.",
    });
  }

  if (out.length === 0 && !organicPromotion.candidateForPromotion) {
    return [];
  }

  return out;
}
