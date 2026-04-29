/**
 * Compact scan summary: top positive drivers + limiting factors from score explanations.
 */

import type { ScoreExplanations, TopLeadDriversJson } from "./types";

export function buildTopLeadDriversJson(se: ScoreExplanations): TopLeadDriversJson {
  const pos = (se.top_positive_drivers ?? []).filter((s) => typeof s === "string" && s.trim().length > 0);
  const neg = (se.top_negative_drivers ?? []).filter((s) => typeof s === "string" && s.trim().length > 0);
  return {
    topPositive: pos.slice(0, 3),
    limitingFactors: neg.slice(0, 2),
  };
}
