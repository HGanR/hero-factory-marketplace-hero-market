import {
  appendCampaignBriefIfMissing,
  extractCampaignBriefFromNotes,
  notesContainCampaignBriefMarker,
  wrapCampaignBriefWithMarkers,
} from "./unified-generation-markers";
import {
  formatUnifiedGenerationPromptAddendum,
  buildUnifiedGenerationPromptData,
} from "./formatUnifiedGenerationPrompt";
import { checkCampaignUnifiedContextThin } from "./generation-signal-gate";
import { classifyUnifiedSignalStrength } from "./unified-signal-strength";
import type { UnifiedGenerationContext } from "./unified-generation-types";
import { DEFAULT_GENERATION_RULES } from "./unified-generation-types";
import { buildUnifiedGenerationAuditPayload } from "./unified-generation-audit";

describe("unified generation markers", () => {
  it("does not duplicate the same brief fingerprint", () => {
    const brief = "Do more on tiktok";
    const once = appendCampaignBriefIfMissing("", brief);
    const twice = appendCampaignBriefIfMissing(once, brief);
    expect(twice).toBe(once);
  });

  it("extracts embedded campaign brief and leaves rest", () => {
    const wrapped = wrapCampaignBriefWithMarkers("Hello brief");
    const full = `User wrote this.\n\n${wrapped}\n\nMore notes.`;
    const { rest, brief } = extractCampaignBriefFromNotes(full);
    expect(brief).toContain("Hello brief");
    expect(rest).not.toContain("BEGIN_AI_REVENUE_OS_CAMPAIGN_BRIEF");
    expect(notesContainCampaignBriefMarker(full)).toBe(true);
  });
});

describe("formatUnifiedGenerationPromptAddendum", () => {
  const emptyCtx = (): UnifiedGenerationContext => ({
    userNotesOriginal: "x",
    campaignBrief: "",
    bentleyHandoff: null,
    bentleyResolvedFrom: "none",
    bentleyMarketIntelligence: null,
    conversionIntelligence: null,
    operatorNextActionsSummary: null,
    generationRules: DEFAULT_GENERATION_RULES,
    variantOptimizationBias: null,
    contentGenerationMode: null,
    marketSweepGrowthGuidance: null,
    marketIntelligenceDiff: null,
    experimentId: null,
    experimentVariantId: null,
    experimentHookType: null,
    experimentAngle: null,
    experimentCtaType: null,
    experimentTheme: null,
    distributionPriority: null,
    targetPlatform: null,
    targetFormat: null,
    leadCaptureObjective: null,
    recommendedFollowupStyle: null,
    publishingObjective: null,
    targetProfileName: null,
    connectorExecutionMode: null,
    platformConstraintHints: null,
    requiresManualExport: null,
    cadenceObjective: null,
    optimizationReason: null,
    freshnessRequirement: null,
    suppressionContext: null,
    optimizationMemoryGeneration: null,
  });

  it("omits empty sections and ends with generation rules", () => {
    const out = formatUnifiedGenerationPromptAddendum(emptyCtx(), "");
    expect(out).not.toContain("=== USER INPUT ===");
    expect(out).not.toContain("=== BENTLEY MARKET INTELLIGENCE ===");
    expect(out).not.toContain("(none —");
    expect(out).toContain("=== GENERATION RULES ===");
    const rulesIdx = out.lastIndexOf("=== GENERATION RULES ===");
    expect(rulesIdx).toBeGreaterThanOrEqual(0);
    expect(out.slice(rulesIdx)).toContain("GENERATION RULES (machine-readable)");
    expect(out.indexOf("=== GENERATION RULES ===")).toBe(rulesIdx);
  });

  it("places user input first when present", () => {
    const out = formatUnifiedGenerationPromptAddendum(emptyCtx(), "  My operator notes here.  ");
    expect(out.indexOf("=== USER INPUT ===")).toBeLessThan(out.indexOf("=== GENERATION RULES ==="));
    expect(out).toContain("My operator notes here.");
  });

  it("merges execution subsections into EXECUTION CONTEXT when any is set", () => {
    const ctx = emptyCtx();
    ctx.publishingObjective = "publish_now";
    ctx.distributionPriority = 7;
    const out = formatUnifiedGenerationPromptAddendum(ctx, "");
    expect(out).toContain("=== EXECUTION CONTEXT ===");
    expect(out).toContain("— Publishing objective —");
    expect(out).toContain("— Distribution & lead capture —");
    expect(out).not.toContain("=== DISTRIBUTION + LEAD CAPTURE (Phase 5) ===");
  });
});

describe("checkCampaignUnifiedContextThin", () => {
  const emptyCtx = (): UnifiedGenerationContext => ({
    userNotesOriginal: "",
    campaignBrief: "",
    bentleyHandoff: null,
    bentleyResolvedFrom: "none",
    bentleyMarketIntelligence: null,
    conversionIntelligence: null,
    operatorNextActionsSummary: null,
    generationRules: DEFAULT_GENERATION_RULES,
    variantOptimizationBias: null,
    contentGenerationMode: null,
    marketSweepGrowthGuidance: null,
    marketIntelligenceDiff: null,
    experimentId: null,
    experimentVariantId: null,
    experimentHookType: null,
    experimentAngle: null,
    experimentCtaType: null,
    experimentTheme: null,
    distributionPriority: null,
    targetPlatform: null,
    targetFormat: null,
    leadCaptureObjective: null,
    recommendedFollowupStyle: null,
    publishingObjective: null,
    targetProfileName: null,
    connectorExecutionMode: null,
    platformConstraintHints: null,
    requiresManualExport: null,
    cadenceObjective: null,
    optimizationReason: null,
    freshnessRequirement: null,
    suppressionContext: null,
    optimizationMemoryGeneration: null,
  });

  it("allows long notes without Bentley or brief", () => {
    const r = checkCampaignUnifiedContextThin(emptyCtx(), "x".repeat(100));
    expect(r.tooThin).toBe(false);
  });

  it("rejects short notes when Bentley and brief are absent", () => {
    const r = checkCampaignUnifiedContextThin(emptyCtx(), "short note");
    expect(r.tooThin).toBe(true);
    expect(r.reason).toBeDefined();
  });

  it("allows short user input when campaign brief is set on context", () => {
    const ctx = emptyCtx();
    ctx.campaignBrief = "Do X on TikTok";
    const r = checkCampaignUnifiedContextThin(ctx, "short");
    expect(r.tooThin).toBe(false);
  });
});

describe("classifyUnifiedSignalStrength", () => {
  const emptyCtx = (): UnifiedGenerationContext => ({
    userNotesOriginal: "",
    campaignBrief: "",
    bentleyHandoff: null,
    bentleyResolvedFrom: "none",
    bentleyMarketIntelligence: null,
    conversionIntelligence: null,
    operatorNextActionsSummary: null,
    generationRules: DEFAULT_GENERATION_RULES,
    variantOptimizationBias: null,
    contentGenerationMode: null,
    marketSweepGrowthGuidance: null,
    marketIntelligenceDiff: null,
    experimentId: null,
    experimentVariantId: null,
    experimentHookType: null,
    experimentAngle: null,
    experimentCtaType: null,
    experimentTheme: null,
    distributionPriority: null,
    targetPlatform: null,
    targetFormat: null,
    leadCaptureObjective: null,
    recommendedFollowupStyle: null,
    publishingObjective: null,
    targetProfileName: null,
    connectorExecutionMode: null,
    platformConstraintHints: null,
    requiresManualExport: null,
    cadenceObjective: null,
    optimizationReason: null,
    freshnessRequirement: null,
    suppressionContext: null,
    optimizationMemoryGeneration: null,
  });

  it("classifies strong when Bentley present", () => {
    const ctx = emptyCtx();
    ctx.bentleyMarketIntelligence = { _t: 1 } as unknown as UnifiedGenerationContext["bentleyMarketIntelligence"];
    expect(classifyUnifiedSignalStrength(ctx, 0)).toBe("strong");
  });

  it("classifies strong when brief and long user input", () => {
    const ctx = emptyCtx();
    ctx.campaignBrief = "Brief";
    expect(classifyUnifiedSignalStrength(ctx, 121)).toBe("strong");
  });

  it("classifies medium when brief only", () => {
    const ctx = emptyCtx();
    ctx.campaignBrief = "Brief";
    expect(classifyUnifiedSignalStrength(ctx, 10)).toBe("medium");
  });

  it("classifies weak when no brief and short user", () => {
    expect(classifyUnifiedSignalStrength(emptyCtx(), 50)).toBe("weak");
  });
});

describe("buildUnifiedGenerationPromptData", () => {
  const fullCtx = (): UnifiedGenerationContext => ({
    userNotesOriginal: "",
    campaignBrief: "",
    bentleyHandoff: null,
    bentleyResolvedFrom: "none",
    bentleyMarketIntelligence: null,
    conversionIntelligence: null,
    operatorNextActionsSummary: null,
    generationRules: DEFAULT_GENERATION_RULES,
    variantOptimizationBias: null,
    contentGenerationMode: null,
    marketSweepGrowthGuidance: null,
    marketIntelligenceDiff: null,
    experimentId: null,
    experimentVariantId: null,
    experimentHookType: null,
    experimentAngle: null,
    experimentCtaType: null,
    experimentTheme: null,
    distributionPriority: null,
    targetPlatform: null,
    targetFormat: null,
    leadCaptureObjective: null,
    recommendedFollowupStyle: null,
    publishingObjective: null,
    targetProfileName: null,
    connectorExecutionMode: null,
    platformConstraintHints: null,
    requiresManualExport: null,
    cadenceObjective: null,
    optimizationReason: null,
    freshnessRequirement: null,
    suppressionContext: null,
    optimizationMemoryGeneration: null,
  });

  it("ends with GENERATION_RULES and matches formatUnifiedGenerationPromptAddendum", () => {
    const ctx = fullCtx();
    const { addendum, sectionOrder } = buildUnifiedGenerationPromptData(ctx, "");
    expect(sectionOrder[sectionOrder.length - 1]).toBe("GENERATION_RULES");
    expect(addendum).toBe(formatUnifiedGenerationPromptAddendum(ctx, ""));
  });

  it("inserts OPTIMIZATION MEMORY before GENERATION RULES when prompt block is set", () => {
    const ctx = fullCtx();
    ctx.optimizationMemoryGeneration = {
      schemaVersion: 1,
      promptBlock: "=== OPTIMIZATION MEMORY ===\n{\"x\":1}\n",
      injectedEntryIds: ["a"],
      hasEnoughData: true,
    };
    const out = formatUnifiedGenerationPromptAddendum(ctx, "");
    const memIdx = out.indexOf("=== OPTIMIZATION MEMORY ===");
    const rulesIdx = out.lastIndexOf("=== GENERATION RULES ===");
    expect(memIdx).toBeGreaterThanOrEqual(0);
    expect(rulesIdx).toBeGreaterThan(memIdx);
  });

  it("omits optimization memory section when prompt block is empty", () => {
    const ctx = fullCtx();
    ctx.optimizationMemoryGeneration = {
      schemaVersion: 1,
      promptBlock: "   ",
      injectedEntryIds: [],
      hasEnoughData: false,
    };
    const out = formatUnifiedGenerationPromptAddendum(ctx, "");
    expect(out).not.toContain("=== OPTIMIZATION MEMORY ===");
  });

  it("audit payload reflects optimization memory section", () => {
    const ctx = fullCtx();
    ctx.optimizationMemoryGeneration = {
      schemaVersion: 1,
      promptBlock: "=== OPTIMIZATION MEMORY ===\n{}",
      injectedEntryIds: [],
      hasEnoughData: true,
    };
    const audit = buildUnifiedGenerationAuditPayload({
      route: "/test",
      ctx,
      userInputForPrompt: "",
    });
    expect(audit.hasOptimizationMemory).toBe(true);
  });
});
