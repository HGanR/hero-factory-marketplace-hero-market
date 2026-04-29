/**
 * Phase 4I — Rank experiment variants by outcomes; scaling copy for operators.
 */

import type { VariantOutcomeRollup } from "@/lib/generation-memory/aggregateVariantOutcomes";

export type OptimizationThresholds = {
  /** Minimum tracked leads on a variant to treat rates as meaningful. */
  minTrackedLeads: number;
  /** Minimum deployments linked (distribution footprint). */
  minDeployments: number;
};

export const DEFAULT_OPTIMIZATION_THRESHOLDS: OptimizationThresholds = {
  minTrackedLeads: 3,
  minDeployments: 1,
};

export type RankedVariant = {
  variantId: string;
  variantTag: string;
  trackedLeadCount: number;
  deploymentCount: number;
  bookedRate: number;
  closeRate: number;
  closedRevenue: number;
  /** Weighted score for ordering (0..1 scale + revenue bonus). */
  score: number;
  meetsSampleThreshold: boolean;
};

export type VariantOptimizationResult = {
  thresholds: OptimizationThresholds;
  ranked: RankedVariant[];
  winner: RankedVariant | null;
  runnerUp: RankedVariant | null;
  underperformers: RankedVariant[];
  insufficientSample: boolean;
  recommendations: {
    scale: string[];
    createMoreLike: string[];
    avoid: string[];
  };
};

function safeRate(num: number, den: number): number {
  if (den <= 0) return 0;
  return num / den;
}

/**
 * Booked rate = booked-only / leads. Close rate = closed / leads.
 */
export function rankVariantsByPerformance(
  rollups: VariantOutcomeRollup[],
  thresholds: OptimizationThresholds = DEFAULT_OPTIMIZATION_THRESHOLDS
): RankedVariant[] {
  const rows: RankedVariant[] = rollups.map((r) => {
    const n = r.trackedLeadCount;
    const d = r.deploymentIds.length;
    const bookedRate = safeRate(r.bookedOnlyCount, n);
    const closeRate = safeRate(r.closedCount, n);
    const rev = r.closedRevenue;
    const meets = n >= thresholds.minTrackedLeads && d >= thresholds.minDeployments;
    // Normalize revenue: assume $50k cap for scoring stability
    const revNorm = Math.min(1, rev / 50_000);
    const score =
      0.35 * bookedRate + 0.35 * closeRate + 0.15 * Math.min(1, n / 20) + 0.15 * revNorm;
    return {
      variantId: r.variantId,
      variantTag: r.variantTag,
      trackedLeadCount: n,
      deploymentCount: d,
      bookedRate,
      closeRate,
      closedRevenue: rev,
      score,
      meetsSampleThreshold: meets,
    };
  });

  return rows.sort((a, b) => {
    const eligible = (x: RankedVariant) => x.meetsSampleThreshold;
    if (eligible(a) !== eligible(b)) return eligible(a) ? -1 : 1;
    if (b.score !== a.score) return b.score - a.score;
    return b.closedRevenue - a.closedRevenue;
  });
}

export function buildVariantOptimization(
  rollups: VariantOutcomeRollup[],
  thresholds: OptimizationThresholds = DEFAULT_OPTIMIZATION_THRESHOLDS,
  signals?: {
    winnerPainThemes: string[];
    winnerCtaAngles: string[];
    winnerOfferAngles: string[];
    loserPainThemes: string[];
    loserCtaAngles: string[];
  }
): VariantOptimizationResult {
  const ranked = rankVariantsByPerformance(rollups, thresholds);
  const eligible = ranked.filter((r) => r.meetsSampleThreshold);
  const insufficientSample = eligible.length === 0 && ranked.some((r) => r.trackedLeadCount > 0);

  const winner = eligible[0] ?? null;
  const runnerUp = eligible[1] ?? null;
  const underperformers = eligible.slice(2);

  const scale: string[] = [];
  const createMoreLike: string[] = [];
  const avoid: string[] = [];

  if (winner) {
    scale.push(
      `Scale variant ${winner.variantTag}: highest composite score (${(winner.score * 100).toFixed(0)} pts) with ${winner.trackedLeadCount} tracked leads.`
    );
    if (winner.bookedRate >= winner.closeRate) {
      scale.push("Bookings are strong vs closes — tighten follow-up to push closed-won.");
    } else {
      scale.push("Closes are outpacing raw bookings — this angle may filter for high intent.");
    }
  } else if (ranked[0]) {
    scale.push(
      `Not enough leads per variant yet (need ≥${thresholds.minTrackedLeads} tracked). Keep deploying linked posts to reach confidence.`
    );
  }

  if (winner && signals?.winnerCtaAngles?.length) {
    createMoreLike.push(`Reuse CTA angles: ${signals.winnerCtaAngles.slice(0, 3).join(" · ")}`);
  }
  if (winner && signals?.winnerOfferAngles?.length) {
    createMoreLike.push(`Double down on offer framing: ${signals.winnerOfferAngles.slice(0, 2).join(" · ")}`);
  }
  if (winner && signals?.winnerPainThemes?.length) {
    createMoreLike.push(`Echo pain themes that resonated: ${signals.winnerPainThemes.slice(0, 3).join(" · ")}`);
  }

  if (runnerUp && winner) {
    createMoreLike.push(
      `Runner-up ${runnerUp.variantTag} is close — generate 2–3 variations blending winner hooks with ${runnerUp.variantTag} structure.`
    );
  }

  const worst = ranked[ranked.length - 1];
  if (winner && worst && worst.variantId !== winner.variantId && worst.trackedLeadCount >= thresholds.minTrackedLeads) {
    avoid.push(
      `Underperformer ${worst.variantTag}: lower score vs ${winner.variantTag} — reduce spend on this pattern until reworked.`
    );
    if (signals?.loserCtaAngles?.length) {
      avoid.push(`Soften or replace CTAs like: ${signals.loserCtaAngles.slice(0, 2).join(" · ")}`);
    }
    if (signals?.loserPainThemes?.length) {
      avoid.push(`Pain framing may be off-market: ${signals.loserPainThemes.slice(0, 2).join(" · ")}`);
    }
  }

  if (createMoreLike.length === 0 && winner) {
    createMoreLike.push("Generate more like this: clone the winning snapshot and run small copy tweaks (hook + CTA only).");
  }

  return {
    thresholds,
    ranked,
    winner,
    runnerUp,
    underperformers,
    insufficientSample,
    recommendations: { scale, createMoreLike, avoid },
  };
}
