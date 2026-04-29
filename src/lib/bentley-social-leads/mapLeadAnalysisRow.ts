/**
 * Map joined DB rows to flat LeadAnalysisRow (analyses list + export).
 */

import type {
  EvidenceByFinding,
  FindingConfidenceJson,
  FindingFeedbackValue,
  RankingDiagnosticsJson,
  TopLeadDriversJson,
} from "./types";
import { deriveHandoffReadinessWithReasons } from "./deriveHandoffReadiness";
import type { LeadAnalysisRow } from "./queryTypes";

function num(s: string | null | undefined): number {
  if (s == null || s === "") return 0;
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

function parseStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string");
}

/** Shared parse for UI / API consumers (legacy flat evidence migrates into weakSpots bucket). */
export function parseStoredEvidenceJson(v: unknown): EvidenceByFinding | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;

  if ("weakSpots" in o || "demandSignals" in o) {
    return {
      weakSpots: parseStringArray(o.weakSpots),
      repeatedBuyerQuestions: parseStringArray(o.repeatedBuyerQuestions),
      objectionThemes: parseStringArray(o.objectionThemes),
      demandSignals: parseStringArray(o.demandSignals),
      actionRationale: parseStringArray(o.actionRationale),
    };
  }

  const weakSpotsLegacy: string[] = [];
  for (const x of parseStringArray(o.weakCta)) weakSpotsLegacy.push(`Weak CTA: ${x}`);
  for (const x of parseStringArray(o.bookingFriction)) weakSpotsLegacy.push(`Booking friction (comments): ${x}`);
  for (const x of parseStringArray(o.trustSignalGaps)) weakSpotsLegacy.push(`Trust: ${x}`);
  for (const x of parseStringArray(o.leadCaptureGaps)) weakSpotsLegacy.push(`Capture: ${x}`);

  return {
    weakSpots: weakSpotsLegacy.slice(0, 24),
    repeatedBuyerQuestions: parseStringArray(o.repeatedBuyerQuestions),
    objectionThemes: parseStringArray(o.objectionThemes),
    demandSignals: [],
    actionRationale: [],
  };
}

export function parseStoredTopLeadDriversJson(v: unknown): TopLeadDriversJson | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const arr = (k: string): string[] =>
    Array.isArray(o[k]) ? (o[k] as unknown[]).filter((x): x is string => typeof x === "string") : [];
  const topPositive = arr("topPositive");
  const limitingFactors = arr("limitingFactors");
  if (!topPositive.length && !limitingFactors.length) return null;
  return { topPositive: topPositive.slice(0, 3), limitingFactors: limitingFactors.slice(0, 2) };
}

export function parseStoredRankingDiagnosticsJson(v: unknown): RankingDiagnosticsJson | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const strArr = (k: string): string[] =>
    Array.isArray(o[k]) ? (o[k] as unknown[]).filter((x): x is string => typeof x === "string") : [];
  const topPositiveDrivers = strArr("topPositiveDrivers");
  const topLimitingFactors = strArr("topLimitingFactors");
  const coveragePenalties = strArr("coveragePenalties");
  const confidencePenalties = strArr("confidencePenalties");
  const actionBiasFactors = strArr("actionBiasFactors");
  if (
    !topPositiveDrivers.length &&
    !topLimitingFactors.length &&
    !coveragePenalties.length &&
    !confidencePenalties.length &&
    !actionBiasFactors.length
  ) {
    return null;
  }
  return {
    topPositiveDrivers: topPositiveDrivers.slice(0, 8),
    topLimitingFactors: topLimitingFactors.slice(0, 8),
    coveragePenalties: coveragePenalties.slice(0, 8),
    confidencePenalties: confidencePenalties.slice(0, 8),
    actionBiasFactors: actionBiasFactors.slice(0, 8),
  };
}

function parseFeedback(v: unknown): FindingFeedbackValue | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (s === "") return null;
  if (s === "correct" || s === "partially_correct" || s === "incorrect") return s;
  return null;
}

export function parseStoredFindingConfidenceJson(v: unknown): FindingConfidenceJson | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const pick = (k: string): number => {
    const x = o[k];
    if (typeof x === "number" && Number.isFinite(x)) return x;
    if (typeof x === "string") {
      const n = parseFloat(x);
      return Number.isFinite(n) ? n : 0.35;
    }
    return 0.35;
  };
  return {
    inferredLeadType: pick("inferredLeadType"),
    inferredCommercialReadiness: pick("inferredCommercialReadiness"),
    repeatedBuyerQuestions: pick("repeatedBuyerQuestions"),
    objectionThemes: pick("objectionThemes"),
    bestOfferAngle: pick("bestOfferAngle"),
  };
}

export type JoinedAnalysisFields = {
  leadRecordId: string;
  analysisId: string;
  businessName: string;
  platform: string;
  handle: string;
  email: string | null;
  websiteUrl: string | null;
  /** From `lead_analysis_runs` join when present. */
  pipelineVersion?: string | null;
  accessStatus: string;
  businessType: string;
  maturityStage: string;
  inferredVertical: string | null;
  leadType: string | null;
  commercialReadiness: string | null;
  coverageJson: unknown;
  opportunityScore: string | null;
  confidenceScore: string | null;
  visibilityScore: string | null;
  demandScore: string | null;
  intentScore: string | null;
  frictionScore: string | null;
  fitScore: string | null;
  bestOfferAngle: string | null;
  suggestedNextMove: string | null;
  summary: string | null;
  commentSummaryJson: unknown;
  rawAnalysisJson: unknown;
  weakSpotsJson: unknown;
  evidenceJson: unknown;
  findingConfidenceJson: unknown;
  actionRationale: string | null;
  operatorOverrideLeadType: string | null;
  operatorOverrideCommercialReadiness: string | null;
  operatorOverrideBestOfferAngle: string | null;
  operatorOverrideWeakSpotsJson: unknown;
  operatorOverrideLeadTypeReason: string | null;
  operatorOverrideCommercialReadinessReason: string | null;
  operatorOverrideBestOfferAngleReason: string | null;
  operatorOverrideWeakSpotsReason: string | null;
  topLeadDriversJson: unknown;
  rankingDiagnosticsJson?: unknown;
  operatorFeedbackLeadType: string | null;
  operatorFeedbackCommercialReadiness: string | null;
  operatorFeedbackWeakSpots: string | null;
  operatorFeedbackBestOfferAngle: string | null;
  operatorStatus: string | null;
  operatorPriority: string | null;
  operatorNotes: string | null;
  manuallyReviewedAt: Date | string | null;
};

export function mapJoinedToLeadAnalysisRow(r: JoinedAnalysisFields): LeadAnalysisRow {
  const cj = r.commentSummaryJson as {
    buyerIntentSignals?: boolean;
    repeatedAcrossPosts?: boolean;
    repeatedAcrossPostsCount?: number;
  } | null;
  const raw = r.rawAnalysisJson as {
    suggestedActionTags?: string[];
    pipelineVersion?: string;
    engineSignals?: {
      intentScore?: { score0To100?: number };
      painType?: string;
      urgency?: string;
      commercialReadinessStage?: string;
      recommendedContentHook?: string;
      recommendedCtaAngle?: string;
    };
  } | null;
  const es = raw?.engineSignals;
  const pipelineVersion =
    (typeof r.pipelineVersion === "string" && r.pipelineVersion.trim()
      ? r.pipelineVersion.trim()
      : null) ??
    (typeof raw?.pipelineVersion === "string" && raw.pipelineVersion.trim() ? raw.pipelineVersion.trim() : null);
  const cov = r.coverageJson as { overallCoverageScore?: number; coverageScore?: number } | null;
  const overallCoverageScore = num(
    cov?.overallCoverageScore != null ? String(cov.overallCoverageScore) : String(cov?.coverageScore ?? 0)
  );

  const inferredLeadType = r.leadType ?? "local_service_business";
  const inferredReadiness = r.commercialReadiness ?? "moderate";
  const inferredWeak = parseStringArray(r.weakSpotsJson);

  const ovLt = r.operatorOverrideLeadType?.trim();
  const ovCr = r.operatorOverrideCommercialReadiness?.trim();
  const ovAngle = r.operatorOverrideBestOfferAngle;
  const ovWeak = parseStringArray(r.operatorOverrideWeakSpotsJson);

  const effectiveLeadType = ovLt || inferredLeadType;
  const effectiveCommercialReadiness = ovCr || inferredReadiness;
  const effectiveBestOfferAngle =
    typeof ovAngle === "string" && ovAngle.trim().length > 0 ? ovAngle : r.bestOfferAngle ?? null;
  const effectiveWeakSpots = r.operatorOverrideWeakSpotsJson != null ? ovWeak : inferredWeak;

  const repeatedAcrossPosts = Boolean(cj?.repeatedAcrossPosts);
  const repeatedAcrossPostsCount =
    typeof cj?.repeatedAcrossPostsCount === "number" && Number.isFinite(cj.repeatedAcrossPostsCount)
      ? cj.repeatedAcrossPostsCount
      : 0;

  const hasOperatorFieldOverrides = Boolean(
    ovLt ||
      ovCr ||
      (typeof ovAngle === "string" && ovAngle.trim().length > 0) ||
      r.operatorOverrideWeakSpotsJson != null
  );
  const hasOperatorReasonNotes = Boolean(
    r.operatorOverrideLeadTypeReason?.trim() ||
      r.operatorOverrideCommercialReadinessReason?.trim() ||
      r.operatorOverrideBestOfferAngleReason?.trim() ||
      r.operatorOverrideWeakSpotsReason?.trim()
  );

  const row: LeadAnalysisRow = {
    leadRecordId: r.leadRecordId,
    analysisId: r.analysisId,
    businessName: r.businessName,
    platform: r.platform,
    handle: r.handle,
    email: r.email,
    websiteUrl: r.websiteUrl,
    pipelineVersion,
    accessStatus: r.accessStatus,
    businessType: r.businessType,
    maturityStage: r.maturityStage,
    inferredVertical: r.inferredVertical ?? "general_service_business",
    inferredLeadType,
    commercialReadiness: inferredReadiness,
    overallCoverageScore,
    opportunityScore: num(r.opportunityScore),
    confidenceScore: num(r.confidenceScore),
    visibilityScore: num(r.visibilityScore),
    demandScore: num(r.demandScore),
    intentScore: num(r.intentScore),
    frictionScore: num(r.frictionScore),
    fitScore: num(r.fitScore),
    bestOfferAngle: r.bestOfferAngle,
    suggestedNextMove: r.suggestedNextMove,
    summary: r.summary,
    buyerIntentPresent: Boolean(cj?.buyerIntentSignals),
    suggestedActionTags: Array.isArray(raw?.suggestedActionTags) ? raw.suggestedActionTags : [],
    operatorStatus: r.operatorStatus ?? "new",
    operatorPriority: r.operatorPriority ?? "normal",
    operatorNotes: r.operatorNotes ?? null,
    manuallyReviewedAt: r.manuallyReviewedAt ? String(r.manuallyReviewedAt) : null,
    actionRationale: r.actionRationale ?? null,
    evidenceJson: parseStoredEvidenceJson(r.evidenceJson),
    findingConfidenceJson: parseStoredFindingConfidenceJson(r.findingConfidenceJson),
    topLeadDriversJson: parseStoredTopLeadDriversJson(r.topLeadDriversJson),
    rankingDiagnosticsJson: parseStoredRankingDiagnosticsJson(r.rankingDiagnosticsJson ?? null),
    inferredWeakSpots: inferredWeak,
    operatorOverrideLeadType: r.operatorOverrideLeadType ?? null,
    operatorOverrideCommercialReadiness: r.operatorOverrideCommercialReadiness ?? null,
    operatorOverrideBestOfferAngle: r.operatorOverrideBestOfferAngle ?? null,
    operatorOverrideWeakSpotsJson: parseStringArray(r.operatorOverrideWeakSpotsJson),
    operatorOverrideLeadTypeReason: r.operatorOverrideLeadTypeReason ?? null,
    operatorOverrideCommercialReadinessReason: r.operatorOverrideCommercialReadinessReason ?? null,
    operatorOverrideBestOfferAngleReason: r.operatorOverrideBestOfferAngleReason ?? null,
    operatorOverrideWeakSpotsReason: r.operatorOverrideWeakSpotsReason ?? null,
    weakSpotsOverrideActive: r.operatorOverrideWeakSpotsJson != null,
    operatorFeedbackLeadType: parseFeedback(r.operatorFeedbackLeadType),
    operatorFeedbackCommercialReadiness: parseFeedback(r.operatorFeedbackCommercialReadiness),
    operatorFeedbackWeakSpots: parseFeedback(r.operatorFeedbackWeakSpots),
    operatorFeedbackBestOfferAngle: parseFeedback(r.operatorFeedbackBestOfferAngle),
    effectiveLeadType,
    effectiveCommercialReadiness,
    effectiveBestOfferAngle,
    effectiveWeakSpots,
    repeatedAcrossPosts,
    repeatedAcrossPostsCount,
    hasOperatorFieldOverrides,
    hasOperatorReasonNotes,
    handoffReadiness: "not_ready",
    handoffReadinessReasons: [],
    engineIntentScore0To100: typeof es?.intentScore?.score0To100 === "number" ? es.intentScore.score0To100 : null,
    enginePainType: typeof es?.painType === "string" ? es.painType : null,
    engineUrgency: typeof es?.urgency === "string" ? es.urgency : null,
    engineCommercialStage: typeof es?.commercialReadinessStage === "string" ? es.commercialReadinessStage : null,
    engineRecommendedHook: typeof es?.recommendedContentHook === "string" ? es.recommendedContentHook : null,
    engineRecommendedCta: typeof es?.recommendedCtaAngle === "string" ? es.recommendedCtaAngle : null,
  };

  const ho = deriveHandoffReadinessWithReasons(row);
  return {
    ...row,
    handoffReadiness: ho.handoffReadiness,
    handoffReadinessReasons: ho.handoffReadinessReasons,
  };
}
