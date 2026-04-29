/**
 * Phase 4H — Persistable snapshot of unified generation context (no circular refs; bounded size).
 */

import { buildBentleyHandoffFingerprint } from "@/lib/revenue-os/bentley-generation-context";
import type { UnifiedGenerationContext } from "@/lib/revenue-os/unified-generation-types";

const MAX_NOTES = 50_000;

export type PersistedGenerationSnapshot = Record<string, unknown>;

export function serializeUnifiedGenerationForStorage(ctx: UnifiedGenerationContext): PersistedGenerationSnapshot {
  const base: Record<string, unknown> = {
    schemaVersion: 1,
    userNotesOriginal: String(ctx.userNotesOriginal ?? "").slice(0, MAX_NOTES),
    campaignBrief: String(ctx.campaignBrief ?? "").slice(0, MAX_NOTES),
    bentleyResolvedFrom: ctx.bentleyResolvedFrom,
    bentleyMarketIntelligence: ctx.bentleyMarketIntelligence,
    conversionIntelligence: ctx.conversionIntelligence,
    operatorNextActionsSummary: ctx.operatorNextActionsSummary,
    generationRules: ctx.generationRules,
    bentleyHandoffFingerprint: ctx.bentleyHandoff ? buildBentleyHandoffFingerprint(ctx.bentleyHandoff) : null,
    handoffId: ctx.bentleyHandoff?.handoffId ?? null,
  };
  if (ctx.variantOptimizationBias) {
    base.variantOptimizationBias = ctx.variantOptimizationBias;
  }
  if (ctx.contentGenerationMode) base.contentGenerationMode = ctx.contentGenerationMode;
  if (ctx.marketSweepGrowthGuidance) base.marketSweepGrowthGuidance = ctx.marketSweepGrowthGuidance;
  if (ctx.marketIntelligenceDiff) base.marketIntelligenceDiff = ctx.marketIntelligenceDiff;
  if (ctx.experimentId) base.experimentId = ctx.experimentId;
  if (ctx.experimentVariantId) base.experimentVariantId = ctx.experimentVariantId;
  if (ctx.experimentTheme) base.experimentTheme = ctx.experimentTheme;
  if (ctx.distributionPriority != null) base.distributionPriority = ctx.distributionPriority;
  if (ctx.targetPlatform) base.targetPlatform = ctx.targetPlatform;
  if (ctx.targetFormat) base.targetFormat = ctx.targetFormat;
  if (ctx.leadCaptureObjective) base.leadCaptureObjective = ctx.leadCaptureObjective;
  if (ctx.recommendedFollowupStyle) base.recommendedFollowupStyle = ctx.recommendedFollowupStyle;
  if (ctx.publishingObjective) base.publishingObjective = ctx.publishingObjective;
  if (ctx.targetProfileName) base.targetProfileName = ctx.targetProfileName;
  if (ctx.connectorExecutionMode) base.connectorExecutionMode = ctx.connectorExecutionMode;
  if (ctx.platformConstraintHints?.length) base.platformConstraintHints = ctx.platformConstraintHints;
  if (ctx.requiresManualExport != null) base.requiresManualExport = ctx.requiresManualExport;
  if (ctx.cadenceObjective) base.cadenceObjective = ctx.cadenceObjective;
  if (ctx.optimizationReason) base.optimizationReason = ctx.optimizationReason;
  if (ctx.freshnessRequirement) base.freshnessRequirement = ctx.freshnessRequirement;
  if (ctx.suppressionContext) base.suppressionContext = ctx.suppressionContext;
  if (ctx.contentBatchRoutingTrace != null) {
    base.contentBatchRoutingTrace = ctx.contentBatchRoutingTrace;
  }
  if (ctx.optimizationMemoryGeneration?.promptBlock) {
    base.optimizationMemoryGeneration = {
      schemaVersion: ctx.optimizationMemoryGeneration.schemaVersion,
      hasEnoughData: ctx.optimizationMemoryGeneration.hasEnoughData,
      injectedEntryIds: ctx.optimizationMemoryGeneration.injectedEntryIds,
      ...(ctx.optimizationMemoryGeneration.promptWeightingSummary
        ? { promptWeightingSummary: ctx.optimizationMemoryGeneration.promptWeightingSummary }
        : {}),
      ...(ctx.optimizationMemoryGeneration.instagramPreferenceHint
        ? { instagramPreferenceHint: ctx.optimizationMemoryGeneration.instagramPreferenceHint }
        : {}),
      ...(ctx.optimizationMemoryGeneration.measuredPlatformRoleHint
        ? { measuredPlatformRoleHint: ctx.optimizationMemoryGeneration.measuredPlatformRoleHint }
        : {}),
      ...(ctx.optimizationMemoryGeneration.platformRoleRoutingHint
        ? { platformRoleRoutingHint: ctx.optimizationMemoryGeneration.platformRoleRoutingHint }
        : {}),
    };
  }
  return JSON.parse(JSON.stringify(base)) as PersistedGenerationSnapshot;
}
