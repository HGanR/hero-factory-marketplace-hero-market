/**
 * Deterministic 0–1 confidence per major finding — complements overall confidenceScore.
 */

import type {
  AccessStatus,
  CommercialCommentSignals,
  CommercialReadiness,
  FindingConfidenceJson,
  InferredLeadType,
  WeakSpotTag,
} from "./types";

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0.35;
  return Math.min(0.95, Math.max(0.12, n));
}

const NON_DEFAULT_LEAD_TYPES = new Set<string>([
  "agency",
  "creator_brand",
  "clinic",
  "storefront",
  "contractor",
  "solo_operator",
]);

export function buildFindingConfidenceJson(args: {
  accessStatus: AccessStatus;
  overallCoverageScore: number;
  confidenceScore: number;
  inferredLeadType: InferredLeadType;
  commercialReadiness: CommercialReadiness;
  commercial: CommercialCommentSignals;
  weakSpots: WeakSpotTag[];
  bestOfferAngle: string;
  hasBuyerIntentInComments: boolean;
}): FindingConfidenceJson {
  const cov = args.overallCoverageScore;
  const conf = args.confidenceScore;
  const accessPenalty = args.accessStatus === "public" ? 0 : args.accessStatus === "access_limited" ? 0.08 : 0.18;

  const leadTypeBoost = NON_DEFAULT_LEAD_TYPES.has(args.inferredLeadType) ? 0.08 : 0;
  const inferredLeadType = clamp01(0.32 + 0.38 * conf + 0.22 * cov + leadTypeBoost - accessPenalty);

  const readinessSignal =
    args.commercialReadiness === "high" ? 0.12 : args.commercialReadiness === "low" ? -0.05 : 0;
  const inferredCommercialReadiness = clamp01(
    0.38 + 0.42 * conf + 0.12 * (args.hasBuyerIntentInComments ? 1 : 0) + readinessSignal * 0.5 - accessPenalty * 0.8
  );

  const rbqCount = args.commercial.repeatedBuyerQuestions.length;
  const rbqRepeatBoost = args.commercial.repeatedAcrossPosts && args.commercial.repeatedAcrossPostsCount >= 2 ? 0.12 : 0;
  const repeatedBuyerQuestions = clamp01(
    0.22 + 0.35 * Math.min(1, rbqCount / 5) + rbqRepeatBoost + 0.25 * conf * cov
  );

  const objCount = args.commercial.objectionClusters.reduce((n, c) => n + c.examples.length, 0);
  const objectionThemes = clamp01(0.2 + 0.45 * Math.min(1, objCount / 6) + 0.22 * conf * cov);

  const angleLen = args.bestOfferAngle.trim().length;
  const weakPenalty = Math.min(0.14, args.weakSpots.length * 0.018);
  const bestOfferAngle = clamp01(0.28 + 0.35 * conf + 0.12 * Math.min(1, angleLen / 420) + 0.2 * cov - weakPenalty);

  return {
    inferredLeadType,
    inferredCommercialReadiness,
    repeatedBuyerQuestions,
    objectionThemes,
    bestOfferAngle,
  };
}
