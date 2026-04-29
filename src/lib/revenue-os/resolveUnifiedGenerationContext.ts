/**
 * Phase 4G — Resolve Bentley + conversion + brief + rules for all generation entrypoints.
 */

import type { BentleyHandoffResolveSource } from "@/lib/revenue-os/bentley-generation-context";
import { buildBentleyGenerationContext } from "@/lib/revenue-os/buildBentleyGenerationContext";
import { resolveBentleyHandoffForGeneration } from "@/lib/revenue-os/resolveBentleyHandoffForGeneration";
import {
  DEFAULT_GENERATION_RULES,
  type ConversionIntelligenceSnapshot,
  type OperatorNextActionsSummary,
  type UnifiedGenerationContext,
  type VariantOptimizationBias,
} from "@/lib/revenue-os/unified-generation-types";
import type { GrowthGuidance, MarketIntelligenceDiff } from "@/lib/revenue-os/market-sweep-schema";
import { loadVariantCloneBiasForUser } from "@/lib/generation-memory/loadVariantCloneBias";
import { extractCampaignBriefFromNotes } from "@/lib/revenue-os/unified-generation-markers";
import { loadConversionAnalyticsForUser } from "@/lib/bentley-social-leads/loadConversionAnalyticsForUser";
import { buildConversionRecommendations } from "@/lib/bentley-social-leads/conversionRecommendations";
import { buildOperatorNextActions } from "@/lib/bentley-social-leads/operatorNextActions";
import { resolveOptimizationMemoryForGeneration } from "@/lib/revenue-os/resolve-optimization-memory-for-generation";

function parseGenerationRules(body: Record<string, unknown>): typeof DEFAULT_GENERATION_RULES {
  const g = body.generationRules;
  if (!g || typeof g !== "object") return { ...DEFAULT_GENERATION_RULES };
  const o = g as Record<string, unknown>;
  return {
    prioritizeConversionSignals: o.prioritizeConversionSignals !== false,
    useBentleyForDemandLanguage: o.useBentleyForDemandLanguage !== false,
    alignHooksAndCtasWithTopPerformers: o.alignHooksAndCtasWithTopPerformers !== false,
    preserveExplicitUserIntent: o.preserveExplicitUserIntent !== false,
  };
}

function conversionOverride(body: Record<string, unknown>): ConversionIntelligenceSnapshot | null {
  const c = body.conversionIntelligence;
  if (!c || typeof c !== "object") return null;
  const x = c as Record<string, unknown>;
  if (x.schemaVersion !== 1) return null;
  if (!x.topPerforming || typeof x.topPerforming !== "object") return null;
  return c as ConversionIntelligenceSnapshot;
}

function parseMarketSweepGrowthFromBody(body: Record<string, unknown>): {
  contentGenerationMode: string | null;
  marketSweepGrowthGuidance: GrowthGuidance | null;
  marketIntelligenceDiff: MarketIntelligenceDiff | null;
  experimentId: string | null;
  experimentVariantId: string | null;
  experimentHookType: string | null;
  experimentAngle: string | null;
  experimentCtaType: string | null;
  experimentTheme: string | null;
  distributionPriority: number | null;
  targetPlatform: string | null;
  targetFormat: string | null;
  leadCaptureObjective: string | null;
  recommendedFollowupStyle: string | null;
  publishingObjective: string | null;
  targetProfileName: string | null;
  connectorExecutionMode: string | null;
  platformConstraintHints: string[] | null;
  requiresManualExport: boolean | null;
  cadenceObjective: string | null;
  optimizationReason: string | null;
  freshnessRequirement: string | null;
  suppressionContext: string | null;
} {
  const cm =
    typeof body.contentGenerationMode === "string" ? body.contentGenerationMode.trim().slice(0, 64) : null;
  const g = body.marketSweepGrowthGuidance;
  let marketSweepGrowthGuidance: GrowthGuidance | null = null;
  if (g && typeof g === "object") {
    const o = g as Record<string, unknown>;
    marketSweepGrowthGuidance = {
      recommendedNextMove: String(o.recommendedNextMove ?? "").slice(0, 2000),
      why: String(o.why ?? "").slice(0, 4000),
      risingTopics: Array.isArray(o.risingTopics) ? o.risingTopics.map((x) => String(x)).slice(0, 16) : [],
      weakAngles: Array.isArray(o.weakAngles) ? o.weakAngles.map((x) => String(x)).slice(0, 16) : [],
      bestHookDirection: String(o.bestHookDirection ?? "").slice(0, 2000),
      ...(typeof o.distributionPlanSummary === "string"
        ? { distributionPlanSummary: o.distributionPlanSummary.slice(0, 1200) }
        : {}),
      ...(typeof o.leadSignalSummaryLine === "string"
        ? { leadSignalSummaryLine: o.leadSignalSummaryLine.slice(0, 1200) }
        : {}),
      ...(o.dominantObjectionCluster != null
        ? { dominantObjectionCluster: String(o.dominantObjectionCluster).slice(0, 400) }
        : {}),
      ...(typeof o.bentleyNextResponseMode === "string"
        ? { bentleyNextResponseMode: o.bentleyNextResponseMode.slice(0, 120) }
        : {}),
      ...(typeof o.workflowSummary === "string" ? { workflowSummary: o.workflowSummary.slice(0, 1200) } : {}),
      ...(typeof o.approvalBottleneckLine === "string"
        ? { approvalBottleneckLine: o.approvalBottleneckLine.slice(0, 800) }
        : {}),
      ...(typeof o.publishFailureLine === "string"
        ? { publishFailureLine: o.publishFailureLine.slice(0, 800) }
        : {}),
      ...(typeof o.unsyncedMetricLine === "string"
        ? { unsyncedMetricLine: o.unsyncedMetricLine.slice(0, 800) }
        : {}),
      ...(typeof o.handoffBacklogLine === "string"
        ? { handoffBacklogLine: o.handoffBacklogLine.slice(0, 800) }
        : {}),
      ...(typeof o.bentleyOperationalNextStep === "string"
        ? { bentleyOperationalNextStep: o.bentleyOperationalNextStep.slice(0, 600) }
        : {}),
      ...(typeof o.connectorCoverageSummary === "string"
        ? { connectorCoverageSummary: o.connectorCoverageSummary.slice(0, 2000) }
        : {}),
      ...(typeof o.autoPublishReadyCount === "number" ? { autoPublishReadyCount: o.autoPublishReadyCount } : {}),
      ...(typeof o.manualFallbackCount === "number" ? { manualFallbackCount: o.manualFallbackCount } : {}),
      ...(typeof o.blockedTargetsCount === "number" ? { blockedTargetsCount: o.blockedTargetsCount } : {}),
      ...(typeof o.recommendedConnectorAction === "string"
        ? { recommendedConnectorAction: o.recommendedConnectorAction.slice(0, 800) }
        : {}),
      ...(typeof o.cadenceSummary === "string" ? { cadenceSummary: o.cadenceSummary.slice(0, 1200) } : {}),
      ...(typeof o.cadenceNextSchedulerAction === "string"
        ? { cadenceNextSchedulerAction: o.cadenceNextSchedulerAction.slice(0, 800) }
        : {}),
      ...(typeof o.cadencePromotionCount === "number" ? { cadencePromotionCount: o.cadencePromotionCount } : {}),
      ...(typeof o.cadenceSuppressionCount === "number" ? { cadenceSuppressionCount: o.cadenceSuppressionCount } : {}),
      ...(typeof o.cadenceRetryCount === "number" ? { cadenceRetryCount: o.cadenceRetryCount } : {}),
      ...(typeof o.cadenceStaleCount === "number" ? { cadenceStaleCount: o.cadenceStaleCount } : {}),
      ...(typeof o.cadenceRetestRecommendationCount === "number"
        ? { cadenceRetestRecommendationCount: o.cadenceRetestRecommendationCount }
        : {}),
    };
  }
  const d = body.marketIntelligenceDiff;
  let marketIntelligenceDiff: MarketIntelligenceDiff | null = null;
  if (d && typeof d === "object") {
    const o = d as Record<string, unknown>;
    marketIntelligenceDiff = {
      hasPrior: o.hasPrior === true,
      newTopics: Array.isArray(o.newTopics) ? o.newTopics.map(String) : [],
      droppedTopics: Array.isArray(o.droppedTopics) ? o.droppedTopics.map(String) : [],
      strengthenedHooks: Array.isArray(o.strengthenedHooks) ? o.strengthenedHooks.map(String) : [],
      weakenedHooks: Array.isArray(o.weakenedHooks) ? o.weakenedHooks.map(String) : [],
      summary: String(o.summary ?? ""),
    };
  }
  const experimentId = typeof body.experimentId === "string" ? body.experimentId.trim().slice(0, 36) : null;
  const experimentVariantId =
    typeof body.experimentVariantId === "string" ? body.experimentVariantId.trim().slice(0, 36) : null;
  const experimentHookType =
    typeof body.hookType === "string" ? body.hookType.trim().slice(0, 64) : null;
  const experimentAngle = typeof body.angle === "string" ? body.angle.trim().slice(0, 500) : null;
  const experimentCtaType = typeof body.ctaType === "string" ? body.ctaType.trim().slice(0, 64) : null;
  const experimentTheme =
    typeof body.experimentTheme === "string" ? body.experimentTheme.trim().slice(0, 300) : null;

  const distributionPriority =
    typeof body.distributionPriority === "number" && Number.isFinite(body.distributionPriority)
      ? Math.max(1, Math.min(10, Math.round(body.distributionPriority)))
      : null;
  const targetPlatform =
    typeof body.targetPlatform === "string" ? body.targetPlatform.trim().slice(0, 64) : null;
  const targetFormat =
    typeof body.targetFormat === "string" ? body.targetFormat.trim().slice(0, 64) : null;
  const leadCaptureObjective =
    typeof body.leadCaptureObjective === "string" ? body.leadCaptureObjective.trim().slice(0, 200) : null;
  const recommendedFollowupStyle =
    typeof body.recommendedFollowupStyle === "string"
      ? body.recommendedFollowupStyle.trim().slice(0, 200)
      : null;
  const publishingObjective =
    typeof body.publishingObjective === "string" ? body.publishingObjective.trim().slice(0, 64) : null;

  const targetProfileName =
    typeof body.targetProfileName === "string" ? body.targetProfileName.trim().slice(0, 200) : null;
  const connectorExecutionMode =
    typeof body.connectorExecutionMode === "string" ? body.connectorExecutionMode.trim().slice(0, 32) : null;
  const platformConstraintHints = Array.isArray(body.platformConstraintHints)
    ? body.platformConstraintHints.map((x) => String(x).trim()).filter(Boolean).slice(0, 16)
    : null;
  const requiresManualExport =
    body.requiresManualExport === true ? true : body.requiresManualExport === false ? false : null;

  const cadenceObjective =
    typeof body.cadenceObjective === "string" ? body.cadenceObjective.trim().slice(0, 80) : null;
  const optimizationReason =
    typeof body.optimizationReason === "string" ? body.optimizationReason.trim().slice(0, 500) : null;
  const freshnessRequirement =
    typeof body.freshnessRequirement === "string" ? body.freshnessRequirement.trim().slice(0, 200) : null;
  const suppressionContext =
    typeof body.suppressionContext === "string" ? body.suppressionContext.trim().slice(0, 400) : null;

  return {
    contentGenerationMode: cm,
    marketSweepGrowthGuidance,
    marketIntelligenceDiff,
    experimentId,
    experimentVariantId,
    experimentHookType,
    experimentAngle,
    experimentCtaType,
    experimentTheme,
    distributionPriority,
    targetPlatform,
    targetFormat,
    leadCaptureObjective,
    recommendedFollowupStyle,
    publishingObjective,
    targetProfileName,
    connectorExecutionMode,
    platformConstraintHints,
    requiresManualExport,
    cadenceObjective,
    optimizationReason,
    freshnessRequirement,
    suppressionContext,
  };
}

function parseVariantOptimizationBiasFromBody(raw: unknown): VariantOptimizationBias | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (o.schemaVersion !== 1) return null;
  const strArr = (v: unknown) => (Array.isArray(v) ? v.map((x) => String(x)).filter(Boolean) : []);
  return {
    schemaVersion: 1,
    sourceVariantId: typeof o.sourceVariantId === "string" ? o.sourceVariantId : null,
    experimentGroupId: typeof o.experimentGroupId === "string" ? o.experimentGroupId : null,
    variantTag: typeof o.variantTag === "string" ? o.variantTag : null,
    operatorHints: typeof o.operatorHints === "string" ? o.operatorHints : "",
    painThemes: strArr(o.painThemes).slice(0, 12),
    ctaAngles: strArr(o.ctaAngles).slice(0, 12),
    offerAngles: strArr(o.offerAngles).slice(0, 12),
    referenceSnapshotBullets: strArr(o.referenceSnapshotBullets).slice(0, 12),
  };
}

export type ResolveUnifiedArgs = {
  body: Record<string, unknown>;
  userId: number | null;
  /** Primary user-authored notes (never overwritten here). */
  userNotes: string;
  /** Explicit campaign brief from API field (wins over embedded markers in notes). */
  explicitCampaignBrief?: string;
  skipConversion?: boolean;
  /** Phase 4I — load bias from saved variant (server-side). */
  cloneFromVariantId?: string;
};

/**
 * Build unified context + a clean user-input string (embedded campaign brief markers stripped for structured prompts).
 */
export async function resolveUnifiedGenerationContext(args: ResolveUnifiedArgs): Promise<{
  context: UnifiedGenerationContext;
  /** Notes safe to show under USER INPUT without duplicating CAMPAIGN BRIEF section */
  userInputForPrompt: string;
}> {
  const { body, userId } = args;
  const generationRules = parseGenerationRules(body);
  const skipConv = Boolean(args.skipConversion) || body.skipConversionIntelligence === true;

  const { handoff: bentleyHandoff, resolvedFrom: bentleyResolvedFrom } = await resolveBentleyHandoffForGeneration(
    body,
    userId
  );

  const bentleyCtx = buildBentleyGenerationContext({
    userNotes: args.userNotes,
    handoff: bentleyHandoff,
    resolvedFrom: bentleyResolvedFrom,
  });
  const bentleyMI = bentleyCtx.bentleyMarketIntelligence;

  const extracted = extractCampaignBriefFromNotes(args.userNotes.trim());
  const explicitBrief =
    typeof args.explicitCampaignBrief === "string"
      ? args.explicitCampaignBrief.trim()
      : typeof body.campaignBrief === "string"
        ? body.campaignBrief.trim()
        : "";

  const campaignBrief = explicitBrief || extracted.brief || "";
  const userInputForPrompt = (extracted.rest.trim() || args.userNotes.trim()).trim();

  let conversionIntelligence: ConversionIntelligenceSnapshot | null = conversionOverride(body);
  let operatorNextActionsSummary: OperatorNextActionsSummary | null = null;

  if (userId != null && !skipConv) {
    try {
      const { summary, hints, rowCount } = await loadConversionAnalyticsForUser(userId, {});
      const actions = buildOperatorNextActions(summary, hints, { newLeadCount: summary.newCount });
      operatorNextActionsSummary = {
        nextBestActionTitle: actions.nextBestAction?.title ?? null,
        nextBestActionDetail: actions.nextBestAction?.detail ?? null,
        bottlenecks: actions.bottlenecks.slice(0, 5),
        opportunities: actions.opportunities.slice(0, 6),
      };

      if (!conversionIntelligence) {
        const { topPerforming, recommendations } = buildConversionRecommendations(summary, bentleyMI);
        conversionIntelligence = {
          schemaVersion: 1,
          rowCount,
          totals: {
            total: summary.total,
            contactedRate: summary.contactedRate,
            bookedRate: summary.bookedRate,
            closeRate: summary.closeRate,
          },
          topPerforming,
          recommendations: recommendations.slice(0, 10),
        };
      }
    } catch {
      if (!conversionIntelligence) {
        conversionIntelligence = null;
      }
      operatorNextActionsSummary = null;
    }
  }

  let variantOptimizationBias: VariantOptimizationBias | null = null;
  const bodyClone =
    typeof body.cloneFromVariantId === "string" ? (body.cloneFromVariantId as string).trim() : "";
  const cloneId =
    (typeof args.cloneFromVariantId === "string" ? args.cloneFromVariantId.trim() : "") || bodyClone;
  if (cloneId && userId != null) {
    variantOptimizationBias = await loadVariantCloneBiasForUser(userId, cloneId);
  }
  if (!variantOptimizationBias) {
    variantOptimizationBias = parseVariantOptimizationBiasFromBody(body.variantOptimizationBias);
  }

  const growth = parseMarketSweepGrowthFromBody(body);

  let optimizationMemoryGeneration: UnifiedGenerationContext["optimizationMemoryGeneration"] = null;
  if (userId != null) {
    try {
      const { getDb } = await import("@/lib/db");
      const db = await getDb();
      const clientId =
        typeof body.clientId === "string" && body.clientId.trim() ? body.clientId.trim() : undefined;
      optimizationMemoryGeneration = await resolveOptimizationMemoryForGeneration(db, {
        userId,
        clientId,
      });
    } catch {
      optimizationMemoryGeneration = null;
    }
  }

  const context: UnifiedGenerationContext = {
    userNotesOriginal: args.userNotes,
    campaignBrief,
    bentleyHandoff: bentleyCtx.bentleyHandoff,
    bentleyResolvedFrom: bentleyCtx.resolvedFrom as BentleyHandoffResolveSource,
    bentleyMarketIntelligence: bentleyMI,
    conversionIntelligence,
    operatorNextActionsSummary,
    generationRules,
    variantOptimizationBias,
    contentGenerationMode: growth.contentGenerationMode,
    marketSweepGrowthGuidance: growth.marketSweepGrowthGuidance,
    marketIntelligenceDiff: growth.marketIntelligenceDiff,
    experimentId: growth.experimentId,
    experimentVariantId: growth.experimentVariantId,
    experimentHookType: growth.experimentHookType,
    experimentAngle: growth.experimentAngle,
    experimentCtaType: growth.experimentCtaType,
    experimentTheme: growth.experimentTheme,
    distributionPriority: growth.distributionPriority,
    targetPlatform: growth.targetPlatform,
    targetFormat: growth.targetFormat,
    leadCaptureObjective: growth.leadCaptureObjective,
    recommendedFollowupStyle: growth.recommendedFollowupStyle,
    publishingObjective: growth.publishingObjective,
    targetProfileName: growth.targetProfileName,
    connectorExecutionMode: growth.connectorExecutionMode,
    platformConstraintHints: growth.platformConstraintHints,
    requiresManualExport: growth.requiresManualExport,
    cadenceObjective: growth.cadenceObjective,
    optimizationReason: growth.optimizationReason,
    freshnessRequirement: growth.freshnessRequirement,
    suppressionContext: growth.suppressionContext,
    optimizationMemoryGeneration,
  };

  return { context, userInputForPrompt };
}
