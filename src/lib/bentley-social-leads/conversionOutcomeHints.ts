/**
 * Operator-facing intelligence from outcomes vs baseline (Phase 4E). Does not auto-change content.
 */

import type { ConversionSummary, DimensionBreakdown } from "./computeConversionSummary";

export type OutcomeInsight = {
  kind: "rate_lift" | "volume" | "warning";
  message: string;
  dimension: string;
  key: string;
  metric: string;
  value: number;
  baseline?: number;
};

function baselineBookedRate(summary: ConversionSummary): number {
  return summary.total > 0 ? summary.booked / summary.total : 0;
}

function topByBookedRate(
  dims: DimensionBreakdown[],
  baseline: number,
  minN: number,
  label: string
): OutcomeInsight[] {
  const out: OutcomeInsight[] = [];
  for (const d of dims) {
    if (d.total < minN) continue;
    const lift = d.bookedRate - baseline;
    if (lift > 0.05 && d.bookedRate > baseline * 1.2) {
      out.push({
        kind: "rate_lift",
        message: `${label} “${d.key.slice(0, 80)}” is booking at ${(d.bookedRate / Math.max(baseline, 0.001)).toFixed(1)}× baseline.`,
        dimension: label,
        key: d.key,
        metric: "bookedRate",
        value: d.bookedRate,
        baseline,
      });
    }
  }
  return out.slice(0, 5);
}

function weakBookingHighEngagement(
  dims: DimensionBreakdown[],
  baseline: number,
  label: string
): OutcomeInsight[] {
  const out: OutcomeInsight[] = [];
  for (const d of dims) {
    if (d.total < 5) continue;
    if (d.contacted / d.total > 0.4 && d.bookedRate < baseline * 0.6 && baseline > 0.05) {
      out.push({
        kind: "warning",
        message: `${label} “${d.key.slice(0, 60)}” drives contact but weak booking vs baseline — review CTA or offer fit.`,
        dimension: label,
        key: d.key,
        metric: "bookedRate",
        value: d.bookedRate,
        baseline,
      });
    }
  }
  return out.slice(0, 3);
}

export function deriveConversionOutcomeHints(summary: ConversionSummary): OutcomeInsight[] {
  const baseline = baselineBookedRate(summary);
  const insights: OutcomeInsight[] = [];

  insights.push(
    ...topByBookedRate(summary.byPlatform, baseline, 3, "Platform"),
    ...topByBookedRate(summary.byPainType.filter((p) => p.key !== "(none)"), baseline, 3, "Pain theme"),
    ...topByBookedRate(summary.byOfferAngle.filter((p) => p.key !== "(no offer snapshot)"), baseline, 2, "Offer angle"),
    ...topByBookedRate(summary.byCtaAngle.filter((p) => !p.key.includes("(no CTA")), baseline, 2, "CTA angle")
  );

  insights.push(...weakBookingHighEngagement(summary.byCtaAngle, baseline, "CTA angle"));

  const topDeploy = summary.byDeployment.find((d) => d.key !== "(no deployment)" && d.total >= 2);
  if (topDeploy && topDeploy.booked >= 2) {
    insights.push({
      kind: "volume",
      message: `Deployment ${topDeploy.key.slice(0, 8)}… has ${topDeploy.booked} booked of ${topDeploy.total} attributed leads.`,
      dimension: "deployment",
      key: topDeploy.key,
      metric: "booked",
      value: topDeploy.booked,
    });
  }

  return insights.slice(0, 12);
}
