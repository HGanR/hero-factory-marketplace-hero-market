import type {
  EvidenceByFinding,
  FindingConfidenceJson,
  FindingFeedbackValue,
  HandoffReadiness,
  RankingDiagnosticsJson,
  TopLeadDriversJson,
} from "./types";

/** Flat row for UI table + CSV export. */
export type LeadAnalysisRow = {
  leadRecordId: string;
  analysisId: string;
  businessName: string;
  platform: string;
  handle: string;
  email: string | null;
  websiteUrl: string | null;
  /** Analysis run pipeline (from join). */
  pipelineVersion: string | null;
  accessStatus: string;
  businessType: string;
  maturityStage: string;
  inferredVertical: string;
  /** Model-inferred value (persisted as leadType). */
  inferredLeadType: string;
  /** Model-inferred readiness. */
  commercialReadiness: string;
  overallCoverageScore: number;
  opportunityScore: number;
  confidenceScore: number;
  visibilityScore: number;
  demandScore: number;
  intentScore: number;
  frictionScore: number;
  fitScore: number;
  bestOfferAngle: string | null;
  suggestedNextMove: string | null;
  summary: string | null;
  buyerIntentPresent: boolean;
  suggestedActionTags: string[];
  operatorStatus: string;
  operatorPriority: string;
  operatorNotes: string | null;
  manuallyReviewedAt: string | null;
  actionRationale: string | null;
  evidenceJson: EvidenceByFinding | null;
  findingConfidenceJson: FindingConfidenceJson | null;
  topLeadDriversJson: TopLeadDriversJson | null;
  rankingDiagnosticsJson: RankingDiagnosticsJson | null;
  /** Weak-spot tags from model (before operator override). */
  inferredWeakSpots: string[];
  operatorOverrideLeadType: string | null;
  operatorOverrideCommercialReadiness: string | null;
  operatorOverrideBestOfferAngle: string | null;
  operatorOverrideWeakSpotsJson: string[];
  /** True when an operator weak-spots list was saved (including empty override). */
  weakSpotsOverrideActive: boolean;
  operatorOverrideLeadTypeReason: string | null;
  operatorOverrideCommercialReadinessReason: string | null;
  operatorOverrideBestOfferAngleReason: string | null;
  operatorOverrideWeakSpotsReason: string | null;
  operatorFeedbackLeadType: FindingFeedbackValue | null;
  operatorFeedbackCommercialReadiness: FindingFeedbackValue | null;
  operatorFeedbackWeakSpots: FindingFeedbackValue | null;
  operatorFeedbackBestOfferAngle: FindingFeedbackValue | null;
  /** Operator-facing effective fields (override when set). */
  effectiveLeadType: string;
  effectiveCommercialReadiness: string;
  effectiveBestOfferAngle: string | null;
  effectiveWeakSpots: string[];
  /** At least one value override (lead type, readiness, angle, or weak spots list). */
  hasOperatorFieldOverrides: boolean;
  /** Any override reason note saved. */
  hasOperatorReasonNotes: boolean;
  repeatedAcrossPosts: boolean;
  repeatedAcrossPostsCount: number;
  /** Derived — operator handoff suitability (no DB column). */
  handoffReadiness: HandoffReadiness;
  /** Why handoff is ready, needs review, or blocked (derived). */
  handoffReadinessReasons: string[];
  /** Lead Intelligence Engine (from rawAnalysisJson.engineSignals) — optional on legacy rows. */
  engineIntentScore0To100: number | null;
  enginePainType: string | null;
  engineUrgency: string | null;
  engineCommercialStage: string | null;
  engineRecommendedHook: string | null;
  engineRecommendedCta: string | null;
};
