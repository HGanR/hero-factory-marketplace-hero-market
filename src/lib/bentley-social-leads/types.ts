/**
 * Bentley Social Lead Intelligence — shared types.
 * Analysis-only; suggestions are manual operator guidance, not automated outreach.
 */

/** Pipeline / scoring bundle version stored on runs and in rawAnalysis. */
export const BENTLEY_SLI_PIPELINE_VERSION = "bentley-sli-v6";

/** Controlled operator workflow — keep in sync with operator PATCH route. */
export const OPERATOR_STATUS_VALUES = [
  "new",
  "reviewing",
  "shortlisted",
  "contacted_manually",
  "not_a_fit",
  "revisit_later",
] as const;
export type OperatorStatus = (typeof OPERATOR_STATUS_VALUES)[number];

/** Analyst calibration feedback on specific findings — separate from overrides. */
export type FindingFeedbackValue = "correct" | "partially_correct" | "incorrect";

/** Derived operator handoff suitability (no DB column on analyses). */
export type HandoffReadiness = "ready" | "review_needed" | "not_ready";

export type TopLeadDriversJson = {
  topPositive: string[];
  limitingFactors: string[];
};

/** Transparency for how opportunity / ordering was influenced (deterministic). */
export type RankingDiagnosticsJson = {
  topPositiveDrivers: string[];
  topLimitingFactors: string[];
  coveragePenalties: string[];
  confidencePenalties: string[];
  actionBiasFactors: string[];
};

/** Standardized profile slice (public metadata only). */
export type ProfileSurface = {
  handle: string;
  displayName?: string;
  bio?: string;
  followerCount?: number;
  followingCount?: number;
  linkInBio?: string;
  profileUrlResolved?: string;
};

export type CoverageBreakdown = {
  profileCoverageScore: number;
  postCoverageScore: number;
  commentCoverageScore: number;
  websiteCoverageScore: number;
  overallCoverageScore: number;
  notes: string[];
};

export type InferredLeadType =
  | "local_service_business"
  | "storefront"
  | "clinic"
  | "creator_brand"
  | "solo_operator"
  | "agency"
  | "contractor";

export type CommercialReadiness = "low" | "moderate" | "high";

export type ComparisonDeltas = {
  opportunityScoreDelta: number;
  confidenceScoreDelta: number;
  /** Ordinal step: A=best; positive = improved letter tier vs compare run. */
  websiteGradeDelta: number;
  visibilityScoreDelta: number;
  demandScoreDelta: number;
  intentScoreDelta: number;
  frictionScoreDelta: number;
  fitScoreDelta: number;
  newlyDetectedWeakSpots: string[];
  resolvedWeakSpots: string[];
  changedBestOfferAngle: boolean;
};

/** Mirrors DB `lead_analyses.accessStatus` — keep in sync with schema.bentley-social-leads. */
export type AccessStatus =
  | "public"
  | "access_limited"
  | "private"
  | "broken_link"
  | "not_found";

export type MaturityStage =
  | "early_stage"
  | "active_but_manual"
  | "growing"
  | "established_but_underoptimized";

export type WeakSpotTag =
  | "no_website"
  | "weak_cta"
  | "dm_booking_only"
  | "no_booking_system"
  | "low_trust_signals"
  | "inconsistent_branding"
  | "no_lead_capture"
  | "manual_follow_up_risk"
  | "weak_offer_clarity"
  | "no_reviews_visible"
  | "no_email_capture"
  | "outdated_site";

export type PostKind =
  | "educational"
  | "promotional"
  | "testimonial"
  | "trend_based"
  | "direct_offer"
  | "weak_cta"
  | "strong_cta"
  | "high_curiosity"
  | "low_buyer_intent"
  | "strong_buyer_intent";

export type CommentKind =
  | "buyer_intent"
  | "price_inquiry"
  | "booking_intent"
  | "objection"
  | "trust_signal"
  | "confusion"
  | "noise"
  | "spam"
  | "peer_support"
  | "repeat_interest";

export type SuggestedActionTag =
  | "manual_comment"
  | "manual_follow"
  | "manual_email"
  | "watch_only"
  | "low_priority";

export type PublicPostMeta = {
  id?: string;
  captionSnippet: string;
  publishedAt?: string;
  viewCount?: number;
  likeCount?: number;
  commentCount?: number;
  /** Heuristic labels only — no video/audio analysis. */
  classifications: PostKind[];
};

export type PublicCommentMeta = {
  text: string;
  authorHandle?: string;
  createdAt?: string;
  classifications: CommentKind[];
};

/** Alias — same row shape as posts/comments in fetchers. */
export type PostSurface = PublicPostMeta;
export type CommentSurface = PublicCommentMeta;

export type WebsiteSurface = {
  url: string;
  ok: boolean;
  title?: string;
  description?: string;
  /** Legacy aggregate — true if newsletter/email field patterns found. */
  hasEmailCaptureHint: boolean;
  hasBookingHint: boolean;
  hasReviewsHint: boolean;
  /** Obvious CTA (book, call, get quote, contact). */
  clearCtaPresent: boolean;
  /** Scheduling / booking path (Calendly, book, appointment). */
  bookingPathPresent: boolean;
  /** Short human-readable summary of phone/email/form hints. */
  contactMethodSummary: string;
  reviewSignalPresent: boolean;
  leadCapturePresent: boolean;
  notes: string[];
};

export type PublicSocialSurface = {
  accessStatus: AccessStatus;
  handle: string;
  displayName?: string;
  bio?: string;
  followerCount?: number;
  followingCount?: number;
  linkInBio?: string;
  profileUrlResolved?: string;
  posts: PublicPostMeta[];
  comments: PublicCommentMeta[];
  /** Short machine-readable reason when access is limited. */
  accessNotes: string[];
  /** Platform-specific extraction notes (what was parsed vs. fallback). */
  extractionNotes?: string[];
  /** Normalized profile slice (optional until pipeline applies). */
  profileSurface?: ProfileSurface;
  /** Mirrors `posts` — explicit contract for operators / coverage. */
  postSurface?: PublicPostMeta[];
  /** Mirrors `comments`. */
  commentSurface?: PublicCommentMeta[];
  /** Filled after linked website fetch in pipeline. */
  linkedWebsiteSurface?: WebsiteSurface | null;
  /** Overall 0–1 extraction coverage (see `coverageBreakdown`). */
  coverageScore?: number;
  coverageBreakdown?: CoverageBreakdown;
  rawHtmlSnippet?: string;
};

export type WebsiteGradeLetter = "A" | "B" | "C" | "D" | "F" | "unknown";

/** Deterministic 0–1 sub-scores + letter grade for operator triage. */
export type WebsiteGradeResult = {
  ctaClarityScore: number;
  trustSignalScore: number;
  /** Higher = more friction (worse). */
  bookingFrictionScore: number;
  leadCaptureScore: number;
  contactAccessibilityScore: number;
  websiteGrade: WebsiteGradeLetter;
  websiteGradeExplanation: string;
};

export type CommercialCommentSignals = {
  repeatedBuyerQuestions: string[];
  objectionClusters: { label: string; examples: string[] }[];
  bookingFrictionSignals: string[];
  urgencySignals: string[];
  locationOrServiceAreaQuestions: string[];
  /** Same buyer-question stem seen across multiple post/comment surfaces. */
  repeatedAcrossPosts: boolean;
  repeatedAcrossPostsCount: number;
};

/**
 * Evidence snippets grouped by finding key — public text only, length-capped upstream.
 * Legacy flat `weakCta`/`bookingFriction`/… rows are migrated at read time into `weakSpots`.
 */
export type EvidenceByFinding = {
  weakSpots: string[];
  repeatedBuyerQuestions: string[];
  objectionThemes: string[];
  demandSignals: string[];
  actionRationale: string[];
};

/** @deprecated Use EvidenceByFinding — kept for migration helpers */
export type LegacyEvidenceJson = {
  repeatedBuyerQuestions: string[];
  objectionThemes: string[];
  weakCta: string[];
  bookingFriction: string[];
  trustSignalGaps: string[];
  leadCaptureGaps: string[];
};

/** 0–1 confidence for specific inferred outputs (deterministic heuristics). */
export type FindingConfidenceJson = {
  inferredLeadType: number;
  inferredCommercialReadiness: number;
  repeatedBuyerQuestions: number;
  objectionThemes: number;
  bestOfferAngle: number;
};

export type NormalizedLead = {
  businessName: string;
  platform: string;
  handle: string;
  profileUrl: string;
  email: string | null;
  websiteUrl: string | null;
  notes: string | null;
};

export type ScoreBundle = {
  visibilityScore: number;
  demandScore: number;
  intentScore: number;
  frictionScore: number;
  fitScore: number;
  opportunityScore: number;
  confidenceScore: number;
};

/** Short operator-facing rationale per dimension (deterministic copy). */
export type ScoreExplanations = {
  visibility_score: string;
  demand_score: string;
  intent_score: string;
  friction_score: string;
  fit_score: string;
  opportunity_score: string;
  top_positive_drivers: string[];
  top_negative_drivers: string[];
  confidence_rationale: string;
};

export type BusinessVertical =
  | "realtor"
  | "tax_professional"
  | "med_spa"
  | "salon"
  | "contractor"
  | "mechanic"
  | "barber"
  | "insurance"
  | "general_service_business";

export type FullLeadAnalysis = {
  accessStatus: AccessStatus;
  summary: string;
  strengths: string[];
  weakSpots: WeakSpotTag[];
  likelyPainPoints: string[];
  businessType: string;
  maturityStage: MaturityStage;
  inferredVertical: BusinessVertical;
  inferredLeadType: InferredLeadType;
  commercialReadiness: CommercialReadiness;
  coverageJson: CoverageBreakdown & { coverageScore: number };
  scoreExplanations: ScoreExplanations;
  accountSummary: Record<string, unknown>;
  contentSummary: Record<string, unknown>;
  commentIntelligenceSummary: Record<string, unknown>;
  commercialCommentSignals: CommercialCommentSignals;
  websiteGrade: WebsiteGradeResult | null;
  pipelineVersion: string;
  repeatedBuyerQuestions: string[];
  objectionThemes: string[];
  demandSignals: string[];
  scores: ScoreBundle;
  bestOfferAngle: string;
  suggestedCommentAngle: string;
  suggestedFollowMessageAngle: string;
  suggestedEmailAngle: string;
  suggestedNextMove: string;
  /** Why this next move was suggested — operator-trust copy. */
  actionRationale: string;
  evidenceJson: EvidenceByFinding;
  findingConfidenceJson: FindingConfidenceJson;
  topLeadDriversJson: TopLeadDriversJson;
  rankingDiagnosticsJson: RankingDiagnosticsJson;
  riskNotes: string[];
  suggestedActionTags: SuggestedActionTag[];
  postClassifications: { index: number; labels: PostKind[] }[];
  rawAnalysis: Record<string, unknown>;
};
