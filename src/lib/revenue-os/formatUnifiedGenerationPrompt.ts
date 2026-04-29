/**
 * Phase 4G — Unified prompt addendum: signal-first, omit empty sections, rules last.
 */

import { BENTLEY_UPSTREAM_INTELLIGENCE_RULES, formatBentleyStructuredBlockForPrompt } from "@/lib/revenue-os/mergeBentleyHandoffIntoGenerationInput";
import type { UnifiedGenerationContext } from "@/lib/revenue-os/unified-generation-types";

export function formatGenerationRulesBlock(rules: UnifiedGenerationContext["generationRules"]): string {
  return [
    "GENERATION RULES (machine-readable)",
    JSON.stringify(rules, null, 2),
    "",
    "Rule gloss:",
    "- Prioritize real conversion signals over assumptions when they conflict.",
    "- Use Bentley for demand-side language (pains, objections, what to post next).",
    "- Align hooks and CTAs with top-performing conversion dimensions when compatible with the offer.",
    "- Do not override explicit user intent in USER INPUT.",
  ].join("\n");
}

function buildBentleySectionBody(ctx: UnifiedGenerationContext): string {
  if (!ctx.bentleyMarketIntelligence) return "";
  return [
    formatBentleyStructuredBlockForPrompt(ctx.bentleyMarketIntelligence),
    "",
    `(Handoff resolution: ${ctx.bentleyResolvedFrom})`,
    BENTLEY_UPSTREAM_INTELLIGENCE_RULES,
  ].join("\n");
}

function buildMarketSweepBody(ctx: UnifiedGenerationContext): string {
  if (!ctx.contentGenerationMode && !ctx.marketSweepGrowthGuidance && !ctx.marketIntelligenceDiff) {
    return "";
  }
  const lines: string[] = [];
  lines.push(`contentGenerationMode: ${ctx.contentGenerationMode ?? "(default)"}`, "");
  if (ctx.marketIntelligenceDiff) {
    lines.push("intelligenceDiff (vs prior snapshot):", JSON.stringify(ctx.marketIntelligenceDiff, null, 2), "");
  }
  if (ctx.marketSweepGrowthGuidance) {
    lines.push("growthGuidance:", JSON.stringify(ctx.marketSweepGrowthGuidance, null, 2), "");
  }
  lines.push(
    "Mode instructions:",
    [
      "- scale_winners: Double down on rising topics and best hook direction; minimize experimental angles.",
      "- iterate_messaging: Test new hooks and objections; avoid repeating weak angles from diff.",
      "- research_first: Favor educational, proof-heavy formats; avoid aggressive CTAs until signals improve.",
      "- balanced / default: Mix proven patterns with one controlled experiment per post set.",
    ].join("\n")
  );
  return lines.join("\n");
}

function buildExperimentBody(ctx: UnifiedGenerationContext): string {
  if (
    !ctx.experimentVariantId &&
    !ctx.experimentHookType &&
    !ctx.experimentAngle &&
    !ctx.experimentCtaType &&
    !ctx.experimentTheme
  ) {
    return "";
  }
  return [
    [
      `experimentId: ${ctx.experimentId ?? "(none)"}`,
      `experimentVariantId: ${ctx.experimentVariantId ?? "(none)"}`,
      `experimentTheme: ${ctx.experimentTheme ?? "(none)"}`,
      `hookType (mandatory style): ${ctx.experimentHookType ?? "(none)"}`,
      `angle (single coherent narrative): ${ctx.experimentAngle ?? "(none)"}`,
      `ctaType (must match): ${ctx.experimentCtaType ?? "(none)"}`,
    ].join("\n"),
    "",
    "Instruction: This generation is ONE experiment cell. Follow hookType, angle, and ctaType strictly. " +
      "Do NOT blend other variants or produce near-duplicate hooks — differentiate structure and opening line clearly from generic templates.",
  ].join("\n");
}

/** Distribution + lead capture block (subset of execution context). */
function buildDistributionBody(ctx: UnifiedGenerationContext): string {
  if (
    ctx.distributionPriority == null &&
    !ctx.targetPlatform &&
    !ctx.targetFormat &&
    !ctx.leadCaptureObjective &&
    !ctx.recommendedFollowupStyle
  ) {
    return "";
  }
  return [
    [
      `distributionPriority (1–10): ${ctx.distributionPriority ?? "(default)"}`,
      `targetPlatform: ${ctx.targetPlatform ?? "(from main prompt)"}`,
      `targetFormat: ${ctx.targetFormat ?? "(from main prompt)"}`,
      `leadCaptureObjective: ${ctx.leadCaptureObjective ?? "(not set)"}`,
      `recommendedFollowupStyle: ${ctx.recommendedFollowupStyle ?? "(not set)"}`,
    ].join("\n"),
    "",
    "Instruction: Match hooks, length, and CTA to targetPlatform + targetFormat. " +
      "Set CTA to reflect leadCaptureObjective — e.g. comment intent, DM intent, application, booking, or proof-building. " +
      "If leadCaptureObjective is proof-building, favor evidence and social proof over hard sell.",
  ].join("\n");
}

function buildPublishingBody(ctx: UnifiedGenerationContext): string {
  if (!ctx.publishingObjective) return "";
  return [
    `publishingObjective: ${ctx.publishingObjective}`,
    "",
    [
      "- publish_now: Final-ready copy; no placeholder tone; strong CTA aligned to platform.",
      "- scheduled_test: Include a one-line test hypothesis; keep structure scannable.",
      "- approval_review: Add a short rationale / strategy note the approver can skim.",
      "- handoff_support: Prioritize trust, proof, objection handling; softer hard-sell.",
    ].join("\n"),
  ].join("\n");
}

function buildConnectorBody(ctx: UnifiedGenerationContext): string {
  if (
    !ctx.targetProfileName &&
    !ctx.connectorExecutionMode &&
    !(ctx.platformConstraintHints && ctx.platformConstraintHints.length) &&
    ctx.requiresManualExport == null
  ) {
    return "";
  }
  return [
    `targetProfileName: ${ctx.targetProfileName ?? "(not set)"}`,
    `connectorExecutionMode: ${ctx.connectorExecutionMode ?? "(not set)"}`,
    `platformConstraintHints: ${ctx.platformConstraintHints?.length ? ctx.platformConstraintHints.join(" | ") : "(none)"}`,
    `requiresManualExport: ${ctx.requiresManualExport === true ? "true" : ctx.requiresManualExport === false ? "false" : "(not set)"}`,
    "",
    [
      "Instruction: Respect platformConstraintHints for length, format, and link placement.",
      "When requiresManualExport is true, produce copy-paste-ready blocks (title, body, hashtags, CTA) with no API-specific placeholders.",
      "When connectorExecutionMode is mock or manual, avoid assuming the post is live — keep language operator-safe.",
    ].join("\n"),
  ].join("\n");
}

function buildCadenceBody(ctx: UnifiedGenerationContext): string {
  if (
    !ctx.cadenceObjective &&
    !ctx.optimizationReason &&
    !ctx.freshnessRequirement &&
    !ctx.suppressionContext
  ) {
    return "";
  }
  return [
    `cadenceObjective: ${ctx.cadenceObjective ?? "(not set)"}`,
    `optimizationReason: ${ctx.optimizationReason ?? "(not set)"}`,
    `freshnessRequirement: ${ctx.freshnessRequirement ?? "(not set)"}`,
    `suppressionContext: ${ctx.suppressionContext ?? "(not set)"}`,
    "",
    [
      "Instruction: For promote_winner — polish for conversion; strong CTA and proof.",
      "For retest_angle — keep one hypothesis; change a single variable (hook OR CTA OR angle).",
      "For evergreen_fill — stable, low-risk, brand-safe copy.",
      "For retry_failed — avoid duplicating prior failure; adjust strategy or platform notes first.",
    ].join("\n"),
  ].join("\n");
}

function buildExecutionContextBody(ctx: UnifiedGenerationContext): string {
  const dist = buildDistributionBody(ctx);
  const pub = buildPublishingBody(ctx);
  const conn = buildConnectorBody(ctx);
  const cad = buildCadenceBody(ctx);
  if (!dist && !pub && !conn && !cad) return "";

  const chunks: string[] = [];
  if (dist) chunks.push("— Distribution & lead capture —", dist);
  if (pub) chunks.push("— Publishing objective —", pub);
  if (conn) chunks.push("— Connector & routing —", conn);
  if (cad) chunks.push("— Cadence & optimization —", cad);
  return chunks.join("\n\n");
}

/** Emitted section identifiers in builder order (stable for logs). */
export const UNIFIED_PROMPT_SECTION_IDS = [
  "USER_INPUT",
  "CAMPAIGN_BRIEF",
  "BENTLEY_MARKET_INTELLIGENCE",
  "CONVERSION_PERFORMANCE_INSIGHTS",
  "OPERATOR_NEXT_ACTIONS",
  "VARIANT_OPTIMIZATION_BIAS",
  "MARKET_SWEEP_GROWTH_LOOP",
  "BENTLEY_EXPERIMENT_VARIANT",
  "EXECUTION_CONTEXT",
  "OPTIMIZATION_MEMORY",
  "GENERATION_RULES",
] as const;

export type UnifiedPromptSectionId = (typeof UNIFIED_PROMPT_SECTION_IDS)[number];

export type UnifiedGenerationPromptBuild = {
  addendum: string;
  sectionOrder: UnifiedPromptSectionId[];
};

/**
 * Single source of truth for addendum text + section order (instrumentation + formatting).
 */
export function buildUnifiedGenerationPromptData(
  ctx: UnifiedGenerationContext,
  userInputForPrompt: string
): UnifiedGenerationPromptBuild {
  const chunks: string[] = [];
  const sectionOrder: UnifiedPromptSectionId[] = [];

  const userTrim = userInputForPrompt.trim();
  if (userTrim) {
    chunks.push(`=== USER INPUT ===\n${userTrim}`);
    sectionOrder.push("USER_INPUT");
  }

  const briefTrim = ctx.campaignBrief.trim();
  if (briefTrim) {
    chunks.push(`=== CAMPAIGN BRIEF ===\n${briefTrim}`);
    sectionOrder.push("CAMPAIGN_BRIEF");
  }

  const bentleyBody = buildBentleySectionBody(ctx);
  if (bentleyBody) {
    chunks.push(`=== BENTLEY MARKET INTELLIGENCE ===\n${bentleyBody}`);
    sectionOrder.push("BENTLEY_MARKET_INTELLIGENCE");
  }

  if (ctx.conversionIntelligence) {
    chunks.push(`=== CONVERSION PERFORMANCE INSIGHTS ===\n${JSON.stringify(ctx.conversionIntelligence, null, 2)}`);
    sectionOrder.push("CONVERSION_PERFORMANCE_INSIGHTS");
  }

  if (ctx.operatorNextActionsSummary) {
    chunks.push(
      `=== OPERATOR NEXT ACTIONS (summary) ===\n${JSON.stringify(ctx.operatorNextActionsSummary, null, 2)}`
    );
    sectionOrder.push("OPERATOR_NEXT_ACTIONS");
  }

  if (ctx.variantOptimizationBias) {
    const b = ctx.variantOptimizationBias;
    chunks.push(
      `=== VARIANT OPTIMIZATION BIAS (Phase 4I) ===\n${JSON.stringify(b, null, 2)}\n\nInstruction: Treat the reference angles as strategic constraints. Produce fresh copy in the same family (pain, CTA, offer) without duplicating sentences verbatim.`
    );
    sectionOrder.push("VARIANT_OPTIMIZATION_BIAS");
  }

  const sweepBody = buildMarketSweepBody(ctx);
  if (sweepBody) {
    chunks.push(`=== MARKET SWEEP GROWTH LOOP (feedback-driven) ===\n${sweepBody}`);
    sectionOrder.push("MARKET_SWEEP_GROWTH_LOOP");
  }

  const experimentBody = buildExperimentBody(ctx);
  if (experimentBody) {
    chunks.push(`=== BENTLEY EXPERIMENT VARIANT (structured test cell) ===\n${experimentBody}`);
    sectionOrder.push("BENTLEY_EXPERIMENT_VARIANT");
  }

  const executionBody = buildExecutionContextBody(ctx);
  if (executionBody) {
    chunks.push(`=== EXECUTION CONTEXT ===\n${executionBody}`);
    sectionOrder.push("EXECUTION_CONTEXT");
  }

  const mem = ctx.optimizationMemoryGeneration?.promptBlock?.trim();
  if (mem) {
    chunks.push(mem);
    sectionOrder.push("OPTIMIZATION_MEMORY");
  }

  chunks.push(`=== GENERATION RULES ===\n${formatGenerationRulesBlock(ctx.generationRules)}`);
  sectionOrder.push("GENERATION_RULES");

  return { addendum: chunks.join("\n\n"), sectionOrder };
}

/**
 * Signal-priority addendum: dense blocks first, no empty-section placeholders, generation rules last.
 * Omits === USER INPUT === when trimmed input is empty (other sections may still carry brief/Bentley).
 */
export function formatUnifiedGenerationPromptAddendum(
  ctx: UnifiedGenerationContext,
  userInputForPrompt: string
): string {
  return buildUnifiedGenerationPromptData(ctx, userInputForPrompt).addendum;
}
