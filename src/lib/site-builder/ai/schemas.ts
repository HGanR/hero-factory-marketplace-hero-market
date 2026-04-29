import { z } from "zod";
import { SiteBuilderRefinementAnswersSchema } from "@/lib/site-builder/refinement-schema";
import { SiteBuilderAssetMapSchema } from "@/lib/site-builder/site-builder-asset";
import { InspirationBriefSchema } from "@/lib/site-builder/inspiration/inspiration-brief-schema";

/** High-level site intent used for section selection and tone. */
export const SiteIntentSchema = z.enum([
  "landing",
  "portfolio",
  "saas",
  "web3_product",
  "community",
  "ecommerce_light",
  "local_business",
  "trust_operator",
]);

export type SiteIntent = z.infer<typeof SiteIntentSchema>;

export const DesignDirectionSchema = z.enum(["minimal", "bold", "luxe", "cyber", "operator"]);

export type DesignDirection = z.infer<typeof DesignDirectionSchema>;

export const SitePlannerInputSchema = z.object({
  userPrompt: z.string().min(1).max(8000),
  industry: z.string().max(200).optional(),
  market: z.string().max(200).optional(),
  /** First-class intake (optional); combined into `userPrompt` on the client when using guided intake. */
  businessName: z.string().max(200).optional(),
  primaryOffer: z.string().max(800).optional(),
  audience: z.string().max(800).optional(),
  /** Shifts deterministic section composition for layout diversity (0–7). */
  layoutVariantIndex: z.number().int().min(0).max(7).optional(),
  /** Explicit layout family to enforce structural archetype across variant generation. */
  layoutFamilyId: z.string().max(80).optional(),
  /** Human-readable variant strategy note injected by pipeline/planner. */
  variantIntent: z.string().max(240).optional(),
  widgetKey: z.string().max(200).optional(),
  widgetPlacement: z.enum(["body_end", "head_script", "page_body_end"]).optional(),
  siteType: z.union([SiteIntentSchema, z.literal("auto")]).default("auto"),
  designDirection: DesignDirectionSchema.optional(),
  styleIntensity: z.number().min(0).max(100).default(55),
  web3VisualMode: z.boolean().default(false),
  /** Reference URL the user is allowed to use for *pattern* hints (fetched in analyze; not copied). */
  inspirationUrl: z.string().max(2000).optional(),
  competitorUrls: z.array(z.string().max(2000)).max(5).optional(),
  /** If true, only the industry string is used for a synthetic pattern brief (no fetch). */
  inspirationIndustryOnly: z.boolean().optional(),
  /** Filled by POST /api/site-builder/inspiration/analyze, then sent with generation. */
  inspirationBrief: InspirationBriefSchema.optional(),
  /** Conversational / guided intake — merged into narrative and used by layout + content layers. */
  statedConversionGoal: z.string().max(500).optional(),
  statedBrandTone: z.string().max(400).optional(),
  statedDesignPreference: z.string().max(400).optional(),
  statedTrustAndProof: z.string().max(1200).optional(),
});

export type SitePlannerInput = z.infer<typeof SitePlannerInputSchema>;

export const SitemapEntrySchema = z.object({
  slug: z.string().min(1).max(200),
  title: z.string().min(1).max(200),
  purpose: z.string().max(500).optional(),
});

export const SectionRoleSchema = z.enum(["hero", "narrative", "trust", "proof", "conversion"]);

export type SectionRole = z.infer<typeof SectionRoleSchema>;

export const SectionPlanEntrySchema = z.object({
  id: z.string().min(1).max(120),
  registryKey: z.string().min(1).max(80),
  headline: z.string().max(300).optional(),
  purpose: z.string().max(500).optional(),
  /** Cinematic rhythm: biases Troothertz section tone when present. */
  rhythmSurface: z.enum(["light", "dark", "visual"]).optional(),
  /** Section padding scale applied at generation time. */
  spacingScale: z.enum(["tight", "balanced", "spacious"]).optional(),
  /** Funnel role for layout enforcement and differentiation scoring. */
  sectionRole: SectionRoleSchema.optional(),
});

export const StyleModeSchema = z.enum(["web3", "corporate", "minimal", "bold"]);

export type StyleMode = z.infer<typeof StyleModeSchema>;

/** Edit intelligence (Refine); safe to round-trip from the client session. */
export const EditIntentSchema = z.enum([
  "design_token_update",
  "copy_tone_change",
  "visual_change",
  "background_change",
  "media_change",
  "layout_change",
  "section_type_change",
  "proof_change",
  "cta_change",
  "continuity_adjustment",
]);

export type EditIntent = z.infer<typeof EditIntentSchema>;

export const EditScopeSchema = z.enum(["section_only", "section_plus_neighbors", "route_level", "full_rebuild"]);

export type EditScope = z.infer<typeof EditScopeSchema>;

const BrandBrainSessionMemorySchema = z.object({
  dismissedSuggestionCodes: z.array(z.string().max(80)).max(30).optional(),
  acceptedSuggestionCodes: z.array(z.string().max(80)).max(30).optional(),
  prefersStrongConsistencyHeuristic: z.boolean().optional(),
  tokenLevelSuggestionAccepts: z.number().int().min(0).max(100).optional(),
  structuralSuggestionAccepts: z.number().int().min(0).max(100).optional(),
});

const AgencySessionMemorySchema = z.object({
  dismissedTaskIds: z.array(z.string().max(120)).max(36).optional(),
  acceptedTaskIds: z.array(z.string().max(120)).max(36).optional(),
  prefersLaunchReadiness: z.boolean().optional(),
  movingTowardLaunch: z.boolean().optional(),
  deliverableDismissedIds: z.array(z.string().max(80)).max(24).optional(),
  conversionSuggestionAccepts: z.number().int().min(0).max(100).optional(),
  deliverableSuggestionAccepts: z.number().int().min(0).max(100).optional(),
});

export const SessionEditContextSchema = z.object({
  lastSectionId: z.string().max(120).optional(),
  lastBatchSectionIds: z.array(z.string().max(120)).max(3).optional(),
  lastEditIntents: z.array(EditIntentSchema).max(24).optional(),
  lastEditScope: EditScopeSchema.optional(),
  prefersCopyTweaks: z.boolean().optional(),
  prefersStructuralEdits: z.boolean().optional(),
  styleDrift: z.enum(["minimal", "bold", "corporate", "web3"]).optional(),
  brandBrainSession: BrandBrainSessionMemorySchema.optional(),
  agencySession: AgencySessionMemorySchema.optional(),
});

export type SessionEditContextPayload = z.infer<typeof SessionEditContextSchema>;

export const CinematicBackgroundModeSchema = z.enum([
  "white-editorial",
  "dark-cinematic",
  "holographic-gradient",
  "glass-grid",
  "luxury-minimal",
]);
export const LegacyBackgroundModeSchema = z.enum([
  "simple_gradients",
  "abstract_gradients",
  "custom_gradient",
  "custom_color",
  "custom_media",
]);
export const BackgroundModeSchema = z.union([LegacyBackgroundModeSchema, CinematicBackgroundModeSchema]);
export const GradientStyleSchema = z.enum(["neon-radial", "aurora", "chrome", "soft-mesh", "none"]);
export const CinematicButtonStyleSchema = z.enum(["glow", "glass", "bold-solid", "chrome", "minimal"]);
export const DepthStyleSchema = z.enum(["flat", "card-depth", "cinematic-layered", "floating-panels"]);
export const MotionHintSchema = z.enum(["none", "subtle-parallax", "scroll-reveal", "floating-orbs"]);

export const DesignTokenProposalSchema = z.object({
  accent: z.string().max(40).optional(),
  surface: z.string().max(40).optional(),
  /** Drives the TROOTHHERTZ visual engine; omitted values are inferred in `generateSiteSchemaFromPlanner` (not a user control). */
  styleMode: StyleModeSchema.optional(),
  backgroundMode: BackgroundModeSchema.optional(),
  gradientStart: z.string().max(40).optional(),
  gradientEnd: z.string().max(40).optional(),
  motionIntensity: z.number().min(0).max(100).optional(),
  /** Cinematic layer: preview + export map these; legacy builds may omit. */
  gradientStyle: GradientStyleSchema.optional(),
  buttonStyle: CinematicButtonStyleSchema.optional(),
  depthStyle: DepthStyleSchema.optional(),
  motionHint: MotionHintSchema.optional(),
});

export type DesignTokenProposal = z.infer<typeof DesignTokenProposalSchema>;

export const SitePlannerOutputSchema = z.object({
  version: z.literal(1),
  intent: SiteIntentSchema,
  normalizedBrief: z.string().max(4000),
  sitemap: z.array(SitemapEntrySchema).min(1).max(50),
  sectionPlan: z.array(SectionPlanEntrySchema).min(1).max(80),
  designTokens: DesignTokenProposalSchema,
  brandVoice: z.object({
    tone: z.string().max(200),
    keywords: z.array(z.string().max(80)).max(24),
  }),
  conversionGoal: z.string().max(400),
  /** When true, planner suggests on-chain adjacent sections later — informational only in v1. */
  web3ExtensionHints: z
    .object({
      walletPersonalizationReady: z.boolean(),
      tokenGatedSectionsPossible: z.boolean(),
      manualApprovalRequiredForContractWrites: z.boolean(),
    })
    .optional(),
});

export type SitePlannerOutput = z.infer<typeof SitePlannerOutputSchema>;

export const PageBlueprintSchema = z.object({
  version: z.literal(1),
  primaryPageSlug: z.string().default("/"),
  planner: SitePlannerOutputSchema,
  /** Ordered section ids matching generated blocks (for targeted regen). */
  sectionIds: z.array(z.string()).min(1),
});

export type PageBlueprint = z.infer<typeof PageBlueprintSchema>;

export const EvaluatorFindingSchema = z.object({
  id: z.string(),
  severity: z.enum(["info", "warn", "error"]),
  category: z.enum([
    "accessibility",
    "responsive",
    "performance",
    "design_coherence",
    "dependencies",
    "content",
  ]),
  message: z.string().max(2000),
  blockIndex: z.number().int().optional(),
});

export const SiteEvaluationReportSchema = z.object({
  version: z.literal(1),
  score: z.number().min(0).max(100),
  passed: z.boolean(),
  findings: z.array(EvaluatorFindingSchema),
  dependencyAllowlist: z.array(z.string()),
});

export type SiteEvaluationReport = z.infer<typeof SiteEvaluationReportSchema>;

const PipelineSiteContextSchema = z.object({
  /** When set, resolves per-site BYOK / platform LLM settings for planner + regen. */
  siteId: z.string().uuid().optional(),
  /** Optional client hub / CRM id — stored only on generation intelligence rows, not in prompts. */
  clientId: z.string().max(36).optional(),
});

export const PipelineRequestSchema = z.discriminatedUnion("step", [
  z
    .object({
      step: z.literal("plan"),
      input: SitePlannerInputSchema,
    })
    .merge(PipelineSiteContextSchema),
  z
    .object({
      step: z.literal("generate"),
      input: SitePlannerInputSchema,
      planner: SitePlannerOutputSchema,
      refinement: SiteBuilderRefinementAnswersSchema.optional(),
      siteBuilderAssets: SiteBuilderAssetMapSchema.optional(),
      /** Generator block-level seed (default v1). */
      variantSeed: z.string().max(120).optional(),
      /** Return up to three schema seeds (same planner). */
      variantCount: z.number().int().min(1).max(3).optional(),
    })
    .merge(PipelineSiteContextSchema),
  z
    .object({
      step: z.literal("evaluate"),
      /** Full SiteSchemaDocument JSON */
      schemaJson: z.unknown(),
    })
    .merge(PipelineSiteContextSchema),
  z
    .object({
      step: z.literal("full"),
      input: SitePlannerInputSchema,
      /** When set, skips re-running the planner (must match a recent plan for this brief). */
      planner: SitePlannerOutputSchema.optional(),
      refinement: SiteBuilderRefinementAnswersSchema.optional(),
      siteBuilderAssets: SiteBuilderAssetMapSchema.optional(),
      variantSeed: z.string().max(120).optional(),
      variantCount: z.number().int().min(1).max(3).optional(),
    })
    .merge(PipelineSiteContextSchema),
  z
    .object({
      step: z.literal("regenerate_section"),
      schemaJson: z.unknown(),
      sectionId: z.string().min(1).max(120),
      instruction: z.string().max(4000).optional(),
      input: SitePlannerInputSchema.partial().optional(),
      sessionEditContext: SessionEditContextSchema.optional(),
    })
    .merge(PipelineSiteContextSchema),
  z
    .object({
      step: z.literal("regenerate_sections_batch"),
      schemaJson: z.unknown(),
      sectionIds: z.array(z.string().min(1).max(120)).min(1).max(3),
      instruction: z.string().max(4000).optional(),
      input: SitePlannerInputSchema.partial().optional(),
      sessionEditContext: SessionEditContextSchema.optional(),
    })
    .merge(PipelineSiteContextSchema),
]);

export type PipelineRequest = z.infer<typeof PipelineRequestSchema>;
