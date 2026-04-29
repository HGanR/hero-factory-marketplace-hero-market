/**
 * Structured “why this rank?” diagnostics — derived from score explanations + coverage + workflow tags.
 */

import type { RankingDiagnosticsJson, ScoreBundle, ScoreExplanations } from "./types";

export function buildRankingDiagnosticsJson(
  scoreExplanations: ScoreExplanations,
  scores: ScoreBundle,
  overallCoverageScore: number,
  suggestedActionTags: string[]
): RankingDiagnosticsJson {
  const topPositiveDrivers = [...(scoreExplanations.top_positive_drivers ?? [])].slice(0, 6);
  const topLimitingFactors = [...(scoreExplanations.top_negative_drivers ?? [])].slice(0, 6);

  const coveragePenalties: string[] = [];
  if (overallCoverageScore < 0.35) {
    coveragePenalties.push("Very low extraction coverage — rank leans on sparse public text.");
  } else if (overallCoverageScore < 0.5) {
    coveragePenalties.push("Below-par coverage — demand/intent/opportunity are less anchored.");
  }
  if (overallCoverageScore < 0.4) {
    coveragePenalties.push("Coverage gap reduces weight on comment and website signals.");
  }

  const confidencePenalties: string[] = [];
  if (scores.confidenceScore < 0.45) {
    confidencePenalties.push("Low model confidence — treat ordering as directional.");
  } else if (scores.confidenceScore < 0.55) {
    confidencePenalties.push("Moderate confidence — verify high-opportunity leads manually.");
  }
  const cr = scoreExplanations.confidence_rationale ?? "";
  if (cr) {
    confidencePenalties.push(cr.length > 320 ? `${cr.slice(0, 317)}…` : cr);
  }

  const actionBiasFactors: string[] = [];
  const tagSet = new Set(suggestedActionTags);
  if (tagSet.has("watch_only")) {
    actionBiasFactors.push("Watchlist bias: surface or readiness suggests delay before outreach planning.");
  }
  if (tagSet.has("manual_email")) {
    actionBiasFactors.push("Manual email path — prioritization favors a human-written first touch.");
  }
  if (tagSet.has("manual_comment")) {
    actionBiasFactors.push("Manual comment path — engagement is comment-led.");
  }
  if (actionBiasFactors.length === 0 && suggestedActionTags.length > 0) {
    actionBiasFactors.push(`Workflow tags: ${suggestedActionTags.join(", ")}.`);
  }

  return {
    topPositiveDrivers,
    topLimitingFactors,
    coveragePenalties,
    confidencePenalties: confidencePenalties.slice(0, 4),
    actionBiasFactors,
  };
}
