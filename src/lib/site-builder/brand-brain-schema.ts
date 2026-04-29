import { z } from "zod";

export const BrandBrainDecisionModeSchema = z.enum(["suggest_only", "safe_auto_apply", "mixed"]);

export type BrandBrainDecisionMode = z.infer<typeof BrandBrainDecisionModeSchema>;

export const BrandBrainFindingSchema = z.object({
  code: z.string().max(80),
  severity: z.enum(["info", "warn"]),
  scope: z.enum(["section", "route", "site"]),
  route: z.string().max(200).optional(),
  sectionId: z.string().max(120).optional(),
  recommendation: z.string().max(500),
});

export type BrandBrainFinding = z.infer<typeof BrandBrainFindingSchema>;

export const BrandBrainScorecardSchema = z.object({
  consistency: z.number().min(0).max(100),
  narrative: z.number().min(0).max(100),
  proofBalance: z.number().min(0).max(100),
  visualRhythm: z.number().min(0).max(100),
});

export type BrandBrainScorecard = z.infer<typeof BrandBrainScorecardSchema>;

export const BrandBrainFixabilitySchema = z.enum(["safe_auto", "suggest", "structural"]);

export const BrandBrainQueueItemSchema = z.object({
  code: z.string().max(80),
  severity: z.enum(["info", "warn"]),
  scope: z.enum(["section", "route", "site"]),
  route: z.string().max(200).optional(),
  sectionId: z.string().max(120).optional(),
  fixability: BrandBrainFixabilitySchema,
  autoApplied: z.boolean(),
  surfacedAsSuggestion: z.boolean(),
  /** Short operator-facing line for Refine */
  label: z.string().max(200),
  recommendation: z.string().max(500),
});

export type BrandBrainQueueItem = z.infer<typeof BrandBrainQueueItemSchema>;

export const BrandBrainStateSchema = z.object({
  version: z.literal(1),
  decisionMode: BrandBrainDecisionModeSchema,
  evaluatedAt: z.string().max(80),
  findings: z.array(BrandBrainFindingSchema).max(48),
  scorecard: BrandBrainScorecardSchema,
  improvementQueue: z.array(BrandBrainQueueItemSchema).max(48),
  lastAppliedCodes: z.array(z.string().max(80)).max(24),
});

export type BrandBrainState = z.infer<typeof BrandBrainStateSchema>;
