/**
 * Normalized post-level optimization memory (Bentley + generation context).
 * Evidence is descriptive only — no implied causality.
 */

import type { ComparableConfidence } from "@/lib/revenue-os/cross-platform-performance-normalization";
import type { RevenueOsPlatformRoleRoutingSummary } from "@/lib/revenue-os/platform-role-routing";

export type RevenueOsOptimizationMemorySource =
  | "campaign_from_notes"
  | "content_engine"
  | "launch_mode"
  | "manual";

export type RevenueOsOptimizationOutcomeKind = "positive" | "negative" | "mixed" | "insufficient_data";

/** Evidence tier for this row (platform capability + whether metrics exist in the bucket). */
export type RevenueOsMemoryEvidenceQuality = "live_metrics" | "publish_only" | "unsupported" | "unknown";

export type RevenueOsOptimizationEvidence = {
  publishCount?: number;
  impressions?: number;
  clicks?: number;
  engagement?: number;
  leads?: number;
  failures?: number;
};

export type RevenueOsOptimizationMemoryEntry = {
  id?: string;
  /** Matches DB `user_id` (stringified app user id). */
  userId?: string;
  clientId?: string | null;
  trustId?: string | null;
  platform?: string | null;
  contentType?: string | null;
  hook?: string | null;
  angle?: string | null;
  cta?: string | null;
  source: RevenueOsOptimizationMemorySource;
  outcomeKind: RevenueOsOptimizationOutcomeKind;
  evidence: RevenueOsOptimizationEvidence;
  summary: string;
  /** Stable key for upsert (platform + normalized hook/angle/cta). */
  patternKey?: string;
  createdAt?: string;
  updatedAt?: string;
  /** Set when entries are enriched for UI/generation (not persisted on older DB rows). */
  evidenceQuality?: RevenueOsMemoryEvidenceQuality;
  confidence?: "high" | "medium" | "low";
};

/** When active, UI/generation may gently favor measured Instagram patterns (see instagram-measured-preference). */
export type InstagramMeasuredPreferenceSummary = {
  active: boolean;
  /** Sum of bucket publish counts for qualifying Instagram live_metrics rows (proxy for volume). */
  measuredPublishingVolume: number;
  /** Same scale as deployment `measuredMetricPostCount` naming for observability. */
  measuredMetricPostCount: number;
  userHeadline: string;
  userWhy: string;
  confidenceLabel: "high" | "medium";
};

export type RevenueOsOptimizationMemorySummary = {
  strongestPatterns: RevenueOsOptimizationMemoryEntry[];
  weakestPatterns: RevenueOsOptimizationMemoryEntry[];
  /** Platform → short hint lines (deterministic order). */
  platformPreferences: Record<string, string[]>;
  hasEnoughData: boolean;
  /** One line for next generation / Bentley. */
  nextGenerationRecommendation: string;
  /** Aggregate confidence for the summary (not a statistical CI). */
  summaryConfidence?: "high" | "medium" | "low";
  /** Strongest platform among measured (live_metrics) informative rows, if any. */
  measuredStrongestPlatform?: string | null;
  /** Strongest measured attention (impressions) aggregated across live_metrics memory rows. */
  measuredStrongestAttentionPlatform?: string | null;
  /** Strongest engagement-style signal (excludes impression mass) across live_metrics memory rows. */
  measuredStrongestEngagementPlatform?: string | null;
  /** Cross-platform comparison confidence for memory (same semantics as deployment rollup). */
  crossPlatformComparisonConfidence?: ComparableConfidence;
  /** Single compact line for generation when attention vs engagement roles differ. */
  measuredPlatformRoleHint?: string | null;
  /** Strongest among publish-only / operational informative signals. */
  operationalStrongestPlatform?: string | null;
  /** What the headline recommendation mainly rests on. */
  recommendationEvidenceBasis?: "live_metrics" | "publish_only" | "mixed" | "insufficient";
  /** Present only when Instagram measured gates pass. */
  instagramMeasuredPreference?: InstagramMeasuredPreferenceSummary | null;
};

export type OptimizationMemoryGenerationSlice = {
  schemaVersion: 1;
  /** Non-empty block for unified prompt; omit section when null. */
  promptBlock: string | null;
  injectedEntryIds: string[];
  hasEnoughData: boolean;
  /** Debug: short note on how platforms were weighted (omit in production UI if undesired). */
  promptWeightingSummary?: string;
  /** Single compact hint when Instagram measured preference is active. */
  instagramPreferenceHint?: string | null;
  /** Attention vs engagement platform roles (when memory has enough signal). */
  measuredPlatformRoleHint?: string | null;
  /** Job-to-be-done channel hints from role routing (memory-led). */
  platformRoleRoutingHint?: string | null;
  /** Structured role→platform routing (for batch routing / snapshots; optional). */
  platformRoleRoutingSummary?: RevenueOsPlatformRoleRoutingSummary | null;
};
