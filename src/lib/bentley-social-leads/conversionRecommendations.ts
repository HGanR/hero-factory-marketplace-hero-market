/**
 * Phase 4F — Structured, explainable recommendations from conversion summary + optional Bentley SLI intelligence.
 */

import type { ConversionSummary, DimensionBreakdown } from "@/lib/bentley-social-leads/computeConversionSummary";
import type { BentleyStructuredMarketIntelligence } from "@/lib/revenue-os/bentley-generation-context";

export type RecommendationKind = "do_more" | "avoid" | "shift";

export type StructuredRecommendation = {
  kind: RecommendationKind;
  dimension: string;
  label: string;
  rationale: string;
};

export type TopPerformingSnapshot = {
  painThemes: string[];
  ctaAngles: string[];
  offerAngles: string[];
  platforms: string[];
};

const MIN_N = 2;

function topKeys(
  dims: DimensionBreakdown[],
  opts: { skip?: (d: DimensionBreakdown) => boolean; take?: number }
): string[] {
  const skip = opts.skip ?? (() => false);
  const take = opts.take ?? 3;
  return dims
    .filter((d) => !skip(d) && d.total >= MIN_N)
    .sort((a, b) => b.bookedRate - a.bookedRate || b.total - a.total)
    .slice(0, take)
    .map((d) => d.key);
}

function bottomKeys(
  dims: DimensionBreakdown[],
  opts: { skip?: (d: DimensionBreakdown) => boolean; take?: number }
): string[] {
  const skip = opts.skip ?? (() => false);
  const take = opts.take ?? 2;
  return dims
    .filter((d) => !skip(d) && d.total >= MIN_N)
    .sort((a, b) => a.bookedRate - b.bookedRate || a.closeRate - b.closeRate)
    .slice(0, take)
    .map((d) => d.key);
}

function norm(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Build “Do more / Avoid / Shift” guidance from conversion data, optionally reconciled with Bentley market intel.
 */
export function buildConversionRecommendations(
  summary: ConversionSummary,
  bentley: BentleyStructuredMarketIntelligence | null | undefined
): { topPerforming: TopPerformingSnapshot; recommendations: StructuredRecommendation[] } {
  const topPerforming: TopPerformingSnapshot = {
    painThemes: topKeys(summary.byPainType, {
      skip: (d) => d.key === "(none)",
    }),
    ctaAngles: topKeys(summary.byCtaAngle, {
      skip: (d) => d.key.includes("(no CTA"),
    }),
    offerAngles: topKeys(summary.byOfferAngle, {
      skip: (d) => d.key === "(no offer snapshot)",
    }),
    platforms: topKeys(summary.byPlatform, { take: 4 }),
  };

  const baseline = summary.total > 0 ? summary.booked / summary.total : 0;
  const recs: StructuredRecommendation[] = [];

  for (const p of topPerforming.platforms.slice(0, 2)) {
    const dim = summary.byPlatform.find((d) => d.key === p);
    if (dim && dim.bookedRate >= baseline * 1.15 && dim.total >= MIN_N) {
      recs.push({
        kind: "do_more",
        dimension: "platform",
        label: p,
        rationale: `Booked rate ${(dim.bookedRate * 100).toFixed(0)}% vs ${(baseline * 100).toFixed(0)}% overall (${dim.total} leads).`,
      });
    }
  }

  for (const pain of topPerforming.painThemes.slice(0, 2)) {
    const dim = summary.byPainType.find((d) => d.key === pain);
    if (dim && dim.bookedRate >= baseline * 1.1 && dim.total >= MIN_N) {
      recs.push({
        kind: "do_more",
        dimension: "pain_theme",
        label: pain,
        rationale: `Strong booking signal in this pain theme (${dim.total} attributed leads).`,
      });
    }
  }

  for (const c of topPerforming.ctaAngles.slice(0, 2)) {
    const dim = summary.byCtaAngle.find((d) => d.key === c);
    if (dim && dim.total >= MIN_N && dim.bookedRate >= baseline) {
      recs.push({
        kind: "do_more",
        dimension: "cta_angle",
        label: c.slice(0, 120),
        rationale: `CTA snapshot angle outperforming or matching baseline on booked rate.`,
      });
    }
  }

  for (const o of topPerforming.offerAngles.slice(0, 2)) {
    const dim = summary.byOfferAngle.find((d) => d.key === o);
    if (dim && dim.total >= MIN_N && dim.closeRate > baseline * 0.8) {
      recs.push({
        kind: "do_more",
        dimension: "offer_angle",
        label: o.slice(0, 120),
        rationale: `Offer angle shows solid close/booking mix (${dim.total} leads).`,
      });
    }
  }

  const weakPlatforms = bottomKeys(summary.byPlatform, { take: 2 });
  for (const p of weakPlatforms) {
    const dim = summary.byPlatform.find((d) => d.key === p);
    if (dim && dim.total >= 4 && dim.bookedRate < baseline * 0.55 && baseline > 0.04) {
      recs.push({
        kind: "avoid",
        dimension: "platform",
        label: p,
        rationale: `Booked rate lags baseline on this platform until messaging is tuned.`,
      });
    }
  }

  const weakCtas = bottomKeys(summary.byCtaAngle, {
    skip: (d) => d.key.includes("(no CTA"),
    take: 2,
  });
  for (const c of weakCtas) {
    const dim = summary.byCtaAngle.find((d) => d.key === c);
    if (dim && dim.total >= 4 && dim.contacted / dim.total > 0.35 && dim.bookedRate < baseline * 0.5) {
      recs.push({
        kind: "avoid",
        dimension: "cta_angle",
        label: c.slice(0, 120),
        rationale: `Drives contact/replies but weak booking — tighten CTA-to-offer bridge.`,
      });
    }
  }

  if (bentley?.topPainThemes?.length && topPerforming.painThemes.length) {
    const bentleyTop = bentley.topPainThemes[0]?.theme;
    const convTop = topPerforming.painThemes[0];
    if (bentleyTop && convTop && norm(bentleyTop) !== norm(convTop)) {
      recs.push({
        kind: "shift",
        dimension: "pain_theme",
        label: convTop,
        rationale: `Bentley batch emphasized “${bentleyTop.slice(0, 80)}” while recent conversions cluster on “${convTop.slice(0, 80)}” — test leaning creative toward the converting theme.`,
      });
    }
  }

  if (bentley?.ctaAngles?.length && topPerforming.ctaAngles.length) {
    const b = bentley.ctaAngles[0];
    const c = topPerforming.ctaAngles[0];
    if (b && c && norm(b) !== norm(c) && summary.total >= 5) {
      recs.push({
        kind: "shift",
        dimension: "cta_angle",
        label: c.slice(0, 120),
        rationale: `Latest SLI CTA ideas skew toward “${b.slice(0, 60)}”; outcomes favor “${c.slice(0, 60)}”.`,
      });
    }
  }

  const seen = new Set<string>();
  const deduped = recs.filter((r) => {
    const k = `${r.kind}:${r.dimension}:${r.label}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  return {
    topPerforming,
    recommendations: deduped.slice(0, 14),
  };
}
