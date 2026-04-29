/**
 * Bentley Social Lead Intelligence Engine — domain model (analysis-only).
 * Ingestion adapters normalize into these shapes; scoring is pure/deterministic.
 */

import type {
  LeadCommercialReadinessStage,
  LeadPainType,
  LeadUrgency,
} from "./taxonomy";

export type {
  LeadCommercialReadinessStage,
  LeadPainType,
  LeadUrgency,
  COMMERCIAL_READINESS_STAGES,
  LEAD_PAIN_TYPES,
  LEAD_URGENCY_LEVELS,
} from "./taxonomy";

/** Supported / planned source platforms (public-surface ingestion only). */
export type LeadSourcePlatform =
  | "tiktok"
  | "youtube"
  | "reddit"
  | "instagram"
  | "facebook_public"
  | "craigslist_public"
  | "unknown";

/** Raw row from a connector before normalization (manual import or future API). */
export type LeadRawRecord = {
  sourcePlatform: LeadSourcePlatform;
  sourceId: string;
  sourceTitle?: string;
  sourceUrl?: string;
  authorHandle: string;
  commentText: string;
  postedAt?: string;
  rawMeta?: Record<string, unknown>;
};

/** Unified comment-level record after normalization. */
export type LeadNormalizedRecord = {
  platform: LeadSourcePlatform;
  sourceContext: string;
  sourceTitle?: string;
  authorHandle: string;
  commentText: string;
  postedAt?: string;
  provenance: LeadProvenance;
};

export type LeadProvenance = {
  connectorId: string;
  ingestedAt: string;
  sourceUrl?: string;
  sourcePostId?: string;
};

export type LeadEvidenceSnippet = {
  text: string;
  kind: "comment" | "post_caption" | "bio" | "website" | "other";
  weight: number;
};

export type LeadIntentClassification = {
  hasExplicitHelpRequest: boolean;
  hasFirstPersonPain: boolean;
  hasRecommendationAsk: boolean;
  hasFrustrationMarkers: boolean;
  hasUrgencyMarkers: boolean;
  hasMoneyOrRevenueRef: boolean;
  hasOwnerSelfId: boolean;
};

export type IntentScoreBreakdownLine = {
  key: string;
  label: string;
  points: number;
  weight: number;
  contribution: number;
};

export type LeadIntentScoreResult = {
  score0To100: number;
  breakdown: IntentScoreBreakdownLine[];
};

export type EngineHandoffReadiness = "ready" | "review_needed" | "not_ready";

/** Full engine bundle attached to analysis (stored under rawAnalysis.engineSignals). */
export type EngineSignals = {
  schemaVersion: 1;
  intentScore: LeadIntentScoreResult;
  painType: LeadPainType;
  urgency: LeadUrgency;
  commercialReadinessStage: LeadCommercialReadinessStage;
  evidenceSnippets: string[];
  recommendedContentHook: string;
  recommendedCtaAngle: string;
  handoffReadiness: EngineHandoffReadiness;
  intentClassification: LeadIntentClassification;
};

/** Engine-only batch aggregates (distinct from `RunBatchSummary` in computeBatchSummary). */
export type EngineLeadBatchSummary = {
  totalLeads: number;
  avgIntentScore0To100: number;
  avgConfidence0To1: number;
  byPlatform: Record<string, number>;
  byPainType: Record<string, number>;
  byUrgency: Record<string, number>;
  byCommercialStage: Record<string, number>;
  byHandoffReadiness: Record<string, number>;
};

export type LeadDriftFlag = {
  code: string;
  message: string;
  segment?: string;
};

export type LeadCalibrationBand = "high_conf" | "mid" | "low_conf";

export type ContentInsightsBatch = {
  schemaVersion: 1;
  topRecurringPainThemes: { theme: string; count: number }[];
  hookIdeas: string[];
  topObjections: { text: string; count: number }[];
  ctaAngles: string[];
  offerAngles: string[];
  contentPillars: string[];
  marketSummary: string;
  whatToPostNext: string[];
  generatedAt: string;
};
