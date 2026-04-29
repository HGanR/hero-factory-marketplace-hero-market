/**
 * Phase 4G — Unified generation context shape (JSON-serializable slices for prompts + APIs).
 */

import type { BentleyStructuredMarketIntelligence } from "@/lib/revenue-os/bentley-generation-context";
import type { BentleyHandoffResolveSource } from "@/lib/revenue-os/bentley-generation-context";
import type { BentleyContentBundleHandoff } from "@/lib/bentley-social-leads/handoff/contentBundleHandoffTypes";
import type {
  GrowthGuidance,
  MarketIntelligenceDiff,
} from "@/lib/revenue-os/market-sweep-schema";
import type { TopPerformingSnapshot, StructuredRecommendation } from "@/lib/bentley-social-leads/conversionRecommendations";
import type { OptimizationMemoryGenerationSlice } from "@/lib/revenue-os/post-optimization-memory-types";

/** Lightweight trace when content-batch routing was computed for this generation context (optional). */
export type ContentBatchRoutingTraceV1 = {
  schemaVersion: 1;
  countsByRole: Record<string, number>;
  routingApplied: boolean;
  roleHintsFromPlatformRouting: boolean;
  /** Roles that received at least one platform hint from measured routing. */
  rolesWithPlatformHints?: string[];
};

export type GenerationRules = {
  prioritizeConversionSignals: boolean;
  useBentleyForDemandLanguage: boolean;
  alignHooksAndCtasWithTopPerformers: boolean;
  preserveExplicitUserIntent: boolean;
};

export const DEFAULT_GENERATION_RULES: GenerationRules = {
  prioritizeConversionSignals: true,
  useBentleyForDemandLanguage: true,
  alignHooksAndCtasWithTopPerformers: true,
  preserveExplicitUserIntent: true,
};

export type ConversionIntelligenceSnapshot = {
  schemaVersion: 1;
  rowCount: number;
  totals: {
    total: number;
    contactedRate: number;
    bookedRate: number;
    closeRate: number;
  };
  topPerforming: TopPerformingSnapshot;
  recommendations: StructuredRecommendation[];
};

export type OperatorNextActionsSummary = {
  nextBestActionTitle: string | null;
  nextBestActionDetail: string | null;
  bottlenecks: string[];
  opportunities: string[];
};

/**
 * Single object describing everything merged into generation (mirrors user JSON shape).
 */
/**
 * Phase 4I — Bias unified generation toward proven variant patterns (clone / scale).
 */
export type VariantOptimizationBias = {
  schemaVersion: 1;
  sourceVariantId: string | null;
  experimentGroupId: string | null;
  variantTag: string | null;
  operatorHints: string;
  painThemes: string[];
  ctaAngles: string[];
  offerAngles: string[];
  /** Bounded lines derived from reference snapshot for the model. */
  referenceSnapshotBullets: string[];
};

export type UnifiedGenerationContext = {
  userNotesOriginal: string;
  /** Explicit campaign brief (may duplicate embedded marker block in notes — prompts dedupe). */
  campaignBrief: string;
  bentleyHandoff: BentleyContentBundleHandoff | null;
  bentleyResolvedFrom: BentleyHandoffResolveSource;
  bentleyMarketIntelligence: BentleyStructuredMarketIntelligence | null;
  conversionIntelligence: ConversionIntelligenceSnapshot | null;
  operatorNextActionsSummary: OperatorNextActionsSummary | null;
  generationRules: GenerationRules;
  /** When set, prompt addendum includes scaling / clone instructions. */
  variantOptimizationBias: VariantOptimizationBias | null;
  /** Market sweep → content engine bias (workflow handoff). */
  contentGenerationMode: string | null;
  marketSweepGrowthGuidance: GrowthGuidance | null;
  marketIntelligenceDiff: MarketIntelligenceDiff | null;
  /** Structured experiment variant targeting (optional). */
  experimentId: string | null;
  experimentVariantId: string | null;
  experimentHookType: string | null;
  experimentAngle: string | null;
  experimentCtaType: string | null;
  experimentTheme: string | null;
  /** Phase 5 — distribution + lead capture bias for unified prompts. */
  distributionPriority: number | null;
  targetPlatform: string | null;
  targetFormat: string | null;
  leadCaptureObjective: string | null;
  recommendedFollowupStyle: string | null;
  /**
   * Publishing intent for copy tone: final vs review pack vs handoff support.
   */
  publishingObjective: string | null;
  /** When routing targets a specific connected profile (generation bias). */
  targetProfileName: string | null;
  /** Expected execution path for the routed target (real | mock | manual). */
  connectorExecutionMode: string | null;
  /** Short hints derived from platform constraints (length, format, link rules). */
  platformConstraintHints: string[] | null;
  /** When true, bias copy toward clean manual copy-paste (no automation assumptions). */
  requiresManualExport: boolean | null;
  /** Cadence scheduler objective for tone and structure. */
  cadenceObjective: string | null;
  optimizationReason: string | null;
  freshnessRequirement: string | null;
  suppressionContext: string | null;
  /** Publish/performance-derived memory for prompts (null when empty or unavailable). */
  optimizationMemoryGeneration: OptimizationMemoryGenerationSlice | null;
  /** When set, snapshot serializers may persist batch routing metadata. */
  contentBatchRoutingTrace?: ContentBatchRoutingTraceV1 | null;
};
