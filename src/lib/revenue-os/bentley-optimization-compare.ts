/**
 * Parent vs child campaign performance comparison (governed social rollups only).
 */

import { eq } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import * as schema from "@/lib/db/schema";
import { buildCampaignGovernedSocialAnalyticsAggregate } from "@/lib/social/governed-post-analytics-aggregate";
import type { NormalizedSocialPostMetrics } from "@/lib/social/governed-post-analytics-types";

export type BentleyOptimizationComparisonPayload = {
  parentCampaignId: string;
  childCampaignId: string;
  parent: {
    impressions: number | null;
    clicks: number | null;
    engagementNumerator: number | null;
    publishedWithSnapshot: number;
  };
  child: {
    impressions: number | null;
    clicks: number | null;
    engagementNumerator: number | null;
    publishedWithSnapshot: number;
  };
  /** Relative deltas (child vs parent); null when denominator missing. */
  ctrDeltaRelative: number | null;
  engagementRateDelta: number | null;
  conversionProxyDeltaRelative: number | null;
  /** -1 … 1 heuristic; null if not comparable. */
  improvementScore: number | null;
  /** True when score is positive and both sides have comparable signal. */
  winningVariant: boolean | null;
  notes: string[];
};

function sumMetric(
  agg: Awaited<ReturnType<typeof buildCampaignGovernedSocialAnalyticsAggregate>>["aggregateMetrics"],
  key: keyof NormalizedSocialPostMetrics
): number | null {
  const v = agg[key];
  if (!v || !Number.isFinite(v.sum)) return null;
  return v.sum;
}

function engagementNum(agg: Awaited<ReturnType<typeof buildCampaignGovernedSocialAnalyticsAggregate>>["aggregateMetrics"]): number | null {
  let n = 0;
  let any = false;
  for (const k of ["reactions", "comments", "shares", "saves"] as const) {
    const v = sumMetric(agg, k);
    if (v != null) {
      any = true;
      n += v;
    }
  }
  return any ? n : null;
}

function rate(num: number | null, den: number | null): number | null {
  if (num == null || den == null || den <= 0) return null;
  return num / den;
}

/**
 * Build comparison from two campaign ids. Does not write DB.
 */
export async function buildBentleyOptimizationComparison(
  db: MySql2Database<typeof schema>,
  parentCampaignId: string,
  childCampaignId: string
): Promise<BentleyOptimizationComparisonPayload> {
  const [parentAgg, childAgg] = await Promise.all([
    buildCampaignGovernedSocialAnalyticsAggregate(db, parentCampaignId),
    buildCampaignGovernedSocialAnalyticsAggregate(db, childCampaignId),
  ]);

  const notes: string[] = [
    "CTR and engagement use governed rollup sums; provider definitions differ — comparison is directional, not proof of causality.",
  ];

  const pi = sumMetric(parentAgg.aggregateMetrics, "impressions");
  const pc = sumMetric(parentAgg.aggregateMetrics, "clicks");
  const pe = engagementNum(parentAgg.aggregateMetrics);

  const ci = sumMetric(childAgg.aggregateMetrics, "impressions");
  const cc = sumMetric(childAgg.aggregateMetrics, "clicks");
  const ce = engagementNum(childAgg.aggregateMetrics);

  const parentCtr = rate(pc, pi);
  const childCtr = rate(cc, ci);
  const parentEng = rate(pe, pi);
  const childEng = rate(ce, ci);

  let ctrDeltaRelative: number | null = null;
  if (parentCtr != null && childCtr != null && parentCtr > 0) {
    ctrDeltaRelative = (childCtr - parentCtr) / parentCtr;
  }

  let engagementRateDelta: number | null = null;
  if (parentEng != null && childEng != null) {
    engagementRateDelta = childEng - parentEng;
  }

  let conversionProxyDeltaRelative: number | null = null;
  if (parentCtr != null && childCtr != null && parentCtr > 0) {
    conversionProxyDeltaRelative = (childCtr - parentCtr) / parentCtr;
  }

  let improvementScore: number | null = null;
  let winningVariant: boolean | null = null;

  const pSnap = parentAgg.campaignSummary.postsWithLatestSnapshot;
  const cSnap = childAgg.campaignSummary.postsWithLatestSnapshot;

  if (pSnap < 1 || cSnap < 1) {
    notes.push("Insufficient synced snapshots on one or both campaigns — scores withheld.");
  } else if (ctrDeltaRelative != null && engagementRateDelta != null) {
    improvementScore = Math.max(-1, Math.min(1, 0.45 * ctrDeltaRelative + 0.55 * Math.tanh(engagementRateDelta * 50)));
    winningVariant = improvementScore > 0.05;
  } else if (ctrDeltaRelative != null) {
    improvementScore = Math.max(-1, Math.min(1, ctrDeltaRelative));
    winningVariant = improvementScore > 0.05;
  }

  return {
    parentCampaignId,
    childCampaignId,
    parent: {
      impressions: pi,
      clicks: pc,
      engagementNumerator: pe,
      publishedWithSnapshot: pSnap,
    },
    child: {
      impressions: ci,
      clicks: cc,
      engagementNumerator: ce,
      publishedWithSnapshot: cSnap,
    },
    ctrDeltaRelative,
    engagementRateDelta,
    conversionProxyDeltaRelative,
    improvementScore,
    winningVariant,
    notes,
  };
}

export async function persistBentleyOptimizationComparison(
  db: MySql2Database<typeof schema>,
  runId: string,
  payload: BentleyOptimizationComparisonPayload
): Promise<void> {
  await db
    .update(schema.bentleyOptimizationRuns)
    .set({
      comparisonJson: payload as unknown as Record<string, unknown>,
      improvementScore: payload.improvementScore != null ? String(payload.improvementScore) : null,
      winningVariant: payload.winningVariant,
    })
    .where(eq(schema.bentleyOptimizationRuns.id, runId));
}
