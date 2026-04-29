import { z } from "zod";

export const LaunchReadinessSchema = z.enum(["draft", "needs_attention", "launch_ready"]);

export type LaunchReadiness = z.infer<typeof LaunchReadinessSchema>;

export const LaunchCheckSchema = z.object({
  code: z.string().max(80),
  severity: z.enum(["info", "warn"]),
  scope: z.enum(["section", "route", "site"]),
  route: z.string().max(200).optional(),
  sectionId: z.string().max(120).optional(),
  recommendation: z.string().max(500),
});

export type LaunchCheck = z.infer<typeof LaunchCheckSchema>;

export const ConversionPathIssueSchema = z.object({
  code: z.string().max(80),
  severity: z.enum(["info", "warn"]),
  scope: z.enum(["route", "site"]),
  route: z.string().max(200).optional(),
  recommendation: z.string().max(500),
});

export type ConversionPathIssue = z.infer<typeof ConversionPathIssueSchema>;

export const CompanionPageSuggestionSchema = z.object({
  code: z.string().max(80),
  suggestedSlug: z.string().max(200),
  priority: z.enum(["high", "medium", "low"]),
  rationale: z.string().max(400),
});

export type CompanionPageSuggestion = z.infer<typeof CompanionPageSuggestionSchema>;

export const AgencyTaskTypeSchema = z.enum([
  "site_fix",
  "content_asset",
  "launch_asset",
  "conversion_improvement",
]);

export const AgencyTaskPrioritySchema = z.enum(["high", "medium", "low"]);

export const AgencyTaskStatusSchema = z.enum(["suggested", "accepted", "dismissed", "auto_applied"]);

export const AgencyDerivedFromSchema = z.enum([
  "brand_brain",
  "launch_readiness",
  "conversion_path",
  "companion_page",
  "deliverable",
]);

export const AgencyTaskSchema = z.object({
  id: z.string().max(120),
  type: AgencyTaskTypeSchema,
  priority: AgencyTaskPrioritySchema,
  scope: z.enum(["section", "route", "site"]),
  status: AgencyTaskStatusSchema,
  recommendation: z.string().max(500),
  label: z.string().max(200),
  derivedFrom: z.array(z.string().max(40)).max(8),
  route: z.string().max(200).optional(),
  sectionId: z.string().max(120).optional(),
  linkedBrandBrainCode: z.string().max(80).optional(),
  refineInstructionHint: z.string().max(500).optional(),
});

export type AgencyTask = z.infer<typeof AgencyTaskSchema>;

export const DeliverableSuggestionSchema = z.object({
  id: z.string().max(80),
  label: z.string().max(220),
  contextRoute: z.string().max(200).optional(),
  derivedFrom: z.array(z.string().max(40)).max(8),
});

export type DeliverableSuggestion = z.infer<typeof DeliverableSuggestionSchema>;

export const AgencyLaunchStateSchema = z.object({
  version: z.literal(1),
  evaluatedAt: z.string().max(80),
  readiness: LaunchReadinessSchema,
  checks: z.array(LaunchCheckSchema).max(48),
  conversionPathIssues: z.array(ConversionPathIssueSchema).max(32),
  companionPageSuggestions: z.array(CompanionPageSuggestionSchema).max(16),
  launchQueue: z.array(AgencyTaskSchema).max(48),
  deliverableSuggestions: z.array(DeliverableSuggestionSchema).max(24),
});

export type AgencyLaunchState = z.infer<typeof AgencyLaunchStateSchema>;
