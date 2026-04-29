/**
 * Pure helpers for Revenue OS / Bentley dashboard — primary lever, plan copy, completion summary.
 */

import type { RevenueOsAnalyzeResponse } from "@/lib/validators/revenue-os";

export type FocusLeverKey = "traffic" | "conversionRatePct" | "avgOrderValue" | "cac";

const FOCUS_LABEL: Record<FocusLeverKey, string> = {
  traffic: "Traffic",
  conversionRatePct: "Conversion rate",
  avgOrderValue: "Average order value",
  cac: "CAC efficiency",
};

/**
 * Pick the lever with the largest normalized gap vs current (deterministic).
 * CAC uses absolute relative change (lower target is better; delta is typically negative).
 */
export function computePrimaryFocusLever(res: RevenueOsAnalyzeResponse): { key: FocusLeverKey; name: string } {
  const l = res.levers;
  const scores: { key: FocusLeverKey; score: number }[] = [
    {
      key: "traffic",
      score: Math.abs(l.traffic.delta) / Math.max(l.traffic.current, 1),
    },
    {
      key: "conversionRatePct",
      score: Math.abs(l.conversionRatePct.delta),
    },
    {
      key: "avgOrderValue",
      score: Math.abs(l.avgOrderValue.delta) / Math.max(l.avgOrderValue.current, 1),
    },
    {
      key: "cac",
      score: Math.abs(l.cac.delta) / Math.max(l.cac.current, 0.01),
    },
  ];
  const best = scores.reduce((a, b) => (a.score >= b.score ? a : b));
  return { key: best.key, name: FOCUS_LABEL[best.key] };
}

/** First actionable plan line across categories (stable order). */
export function firstPlanRecommendation(res: RevenueOsAnalyzeResponse): string | null {
  const p = res.plan;
  const buckets = [
    p.offerEngineering,
    p.funnel,
    p.sales,
    p.capitalAllocation,
    p.optimization,
  ] as const;
  for (const arr of buckets) {
    const line = arr?.find((s) => typeof s === "string" && s.trim().length > 0)?.trim();
    if (line) return line;
  }
  return null;
}

/**
 * Single-line summary after Full Analysis completes (dashboard completion card).
 */
export function bentleyCompletionSummaryLine(res: RevenueOsAnalyzeResponse): string {
  const fmt = (n: number) =>
    n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
  const gap = res.kpis.revenueGap;
  const focus = computePrimaryFocusLever(res);
  const planLine = firstPlanRecommendation(res);
  const base = `Modeled gap about ${fmt(gap)} — primary lever: ${focus.name}.`;
  if (!planLine) return base;
  const hint = planLine.length > 140 ? `${planLine.slice(0, 137)}…` : planLine;
  return `${base} Next: ${hint}`;
}
