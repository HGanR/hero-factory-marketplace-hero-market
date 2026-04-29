/**
 * Explicit deltas between two analysis snapshots (same lead, different runs).
 */

import type { ComparisonDeltas } from "./types";

function num(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function weakList(row: Record<string, unknown>): string[] {
  const w = row.weakSpotsJson;
  if (Array.isArray(w)) return w.map(String);
  return [];
}

function gradeLetter(row: Record<string, unknown>): string {
  const wg = row.websiteGradeJson as Record<string, unknown> | undefined;
  if (wg && typeof wg.websiteGrade === "string") return wg.websiteGrade;
  return "";
}

export function computeComparisonDeltas(
  current: Record<string, unknown>,
  compare: Record<string, unknown>
): ComparisonDeltas {
  const curWeak = new Set(weakList(current));
  const cmpWeak = new Set(weakList(compare));

  const newlyDetectedWeakSpots = [...curWeak].filter((x) => !cmpWeak.has(x));
  const resolvedWeakSpots = [...cmpWeak].filter((x) => !curWeak.has(x));

  const curOffer = typeof current.bestOfferAngle === "string" ? current.bestOfferAngle : "";
  const cmpOffer = typeof compare.bestOfferAngle === "string" ? compare.bestOfferAngle : "";
  const changedBestOfferAngle = curOffer !== cmpOffer;

  const g0 = gradeLetter(compare);
  const g1 = gradeLetter(current);
  let websiteGradeDelta = 0;
  const order = ["unknown", "F", "D", "C", "B", "A"];
  const i0 = order.indexOf(g0);
  const i1 = order.indexOf(g1);
  if (i0 >= 0 && i1 >= 0) websiteGradeDelta = i1 - i0;

  return {
    opportunityScoreDelta: num(current.opportunityScore) - num(compare.opportunityScore),
    confidenceScoreDelta: num(current.confidenceScore) - num(compare.confidenceScore),
    websiteGradeDelta,
    visibilityScoreDelta: num(current.visibilityScore) - num(compare.visibilityScore),
    demandScoreDelta: num(current.demandScore) - num(compare.demandScore),
    intentScoreDelta: num(current.intentScore) - num(compare.intentScore),
    frictionScoreDelta: num(current.frictionScore) - num(compare.frictionScore),
    fitScoreDelta: num(current.fitScore) - num(compare.fitScore),
    newlyDetectedWeakSpots,
    resolvedWeakSpots,
    changedBestOfferAngle,
  };
}
