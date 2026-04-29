import { buildUnifiedGenerationPromptData } from "@/lib/revenue-os/formatUnifiedGenerationPrompt";
import type { UnifiedGenerationContext } from "@/lib/revenue-os/unified-generation-types";
import { classifyUnifiedSignalStrength } from "@/lib/revenue-os/unified-signal-strength";

export type UnifiedGenerationAuditPayload = {
  tag: "unified_generation_audit";
  route: string;
  traceId?: string;
  hasUserInput: boolean;
  userInputLength: number;
  hasCampaignBrief: boolean;
  campaignBriefLength: number;
  hasBentley: boolean;
  hasConversion: boolean;
  hasOperatorActions: boolean;
  hasVariantBias: boolean;
  hasMarketSweep: boolean;
  hasExperiment: boolean;
  hasExecutionContext: boolean;
  hasOptimizationMemory: boolean;
  addendumLength: number;
  sectionOrder: string[];
  userInputOmittedDueToTrim: boolean;
};

/**
 * Audit snapshot for the string actually passed into `buildUnifiedGenerationPromptData`
 * (on campaign-from-notes this is redacted/truncated safe input).
 */
export function buildUnifiedGenerationAuditPayload(input: {
  route: string;
  ctx: UnifiedGenerationContext;
  userInputForPrompt: string;
  traceId?: string;
}): UnifiedGenerationAuditPayload {
  const { ctx, userInputForPrompt, route, traceId } = input;
  const { addendum, sectionOrder } = buildUnifiedGenerationPromptData(ctx, userInputForPrompt);
  const userTrim = userInputForPrompt.trim();
  const briefTrim = ctx.campaignBrief.trim();

  const base: UnifiedGenerationAuditPayload = {
    tag: "unified_generation_audit",
    route,
    hasUserInput: sectionOrder.includes("USER_INPUT"),
    userInputLength: userTrim.length,
    hasCampaignBrief: sectionOrder.includes("CAMPAIGN_BRIEF"),
    campaignBriefLength: briefTrim.length,
    hasBentley: sectionOrder.includes("BENTLEY_MARKET_INTELLIGENCE"),
    hasConversion: sectionOrder.includes("CONVERSION_PERFORMANCE_INSIGHTS"),
    hasOperatorActions: sectionOrder.includes("OPERATOR_NEXT_ACTIONS"),
    hasVariantBias: sectionOrder.includes("VARIANT_OPTIMIZATION_BIAS"),
    hasMarketSweep: sectionOrder.includes("MARKET_SWEEP_GROWTH_LOOP"),
    hasExperiment: sectionOrder.includes("BENTLEY_EXPERIMENT_VARIANT"),
    hasExecutionContext: sectionOrder.includes("EXECUTION_CONTEXT"),
    hasOptimizationMemory: sectionOrder.includes("OPTIMIZATION_MEMORY"),
    addendumLength: addendum.length,
    sectionOrder: [...sectionOrder],
    userInputOmittedDueToTrim: userInputForPrompt.length > 0 && userTrim.length === 0,
  };
  if (traceId !== undefined) base.traceId = traceId;
  return base;
}

export function buildSignalStrengthPayload(input: {
  route: string;
  ctx: UnifiedGenerationContext;
  userInputLength: number;
  traceId?: string;
}): { tag: "signal_strength"; route: string; strength: "strong" | "medium" | "weak"; traceId?: string } {
  return {
    tag: "signal_strength",
    route: input.route,
    strength: classifyUnifiedSignalStrength(input.ctx, input.userInputLength),
    ...(input.traceId !== undefined ? { traceId: input.traceId } : {}),
  };
}
