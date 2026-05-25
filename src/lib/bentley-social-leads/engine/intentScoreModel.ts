import type { CommercialCommentSignals } from "../types";
import type { LeadIntentScoreResult } from "./domainTypes";

export function computeIntentScore0To100(input: {
  corpus: string;
  commercial: CommercialCommentSignals;
  opportunityScore: number;
  intentScore: number;
  confidenceScore: number;
  buyerIntentPresent: boolean;
  overallCoverageScore: number;
}): LeadIntentScoreResult {
  const base =
    22 +
    Math.min(28, input.opportunityScore * 28) +
    Math.min(22, input.intentScore * 22) +
    Math.min(14, input.confidenceScore * 14) +
    (input.buyerIntentPresent ? 8 : 0) +
    Math.min(6, input.overallCoverageScore * 6);
  const bonus = Math.min(10, input.commercial.repeatedBuyerQuestions.length * 2);
  const score0To100 = Math.round(Math.min(100, Math.max(0, base + bonus)));
  return {
    score0To100,
    breakdown: [
      { key: "opportunity", label: "Opportunity", points: input.opportunityScore, weight: 0.35, contribution: input.opportunityScore * 0.35 },
      { key: "intent", label: "Intent", points: input.intentScore, weight: 0.25, contribution: input.intentScore * 0.25 },
      { key: "confidence", label: "Confidence", points: input.confidenceScore, weight: 0.2, contribution: input.confidenceScore * 0.2 },
      { key: "coverage", label: "Coverage", points: input.overallCoverageScore, weight: 0.2, contribution: input.overallCoverageScore * 0.2 },
    ],
  };
}
