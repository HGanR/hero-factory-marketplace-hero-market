import { z } from "zod";

/** Internal-only modernization posture — inferred from site type + import signals (not a user setting). */
export const ImportModernizationProfileSchema = z.enum([
  "preserve_structure_modernize_visuals",
  "preserve_message_improve_conversion",
  "simplify_and_tighten",
  "redesign_offer_leadgen",
  "editorial_cleanup",
]);

export type ImportModernizationProfile = z.infer<typeof ImportModernizationProfileSchema>;

export const ImportedSiteAuditOpportunitySchema = z.object({
  code: z.string().max(80),
  severity: z.enum(["warn", "info"]),
  scope: z.enum(["route", "site"]),
  route: z.string().max(200).optional(),
  recommendation: z.string().max(500),
  fixability: z.enum(["safe_auto", "guided_apply", "structural"]),
});

export type ImportedSiteAuditOpportunity = z.infer<typeof ImportedSiteAuditOpportunitySchema>;

export const ImportedSiteAuditSchema = z.object({
  summary: z.string().max(800),
  /** Inferred modernization posture — guides prioritization (not shown as a separate control). */
  modernizationProfile: ImportModernizationProfileSchema,
  evaluatedAt: z.string().max(80),
  opportunities: z.array(ImportedSiteAuditOpportunitySchema).max(32),
});

export type ImportedSiteAudit = z.infer<typeof ImportedSiteAuditSchema>;

export const ImportRestructureQueueItemSchema = z.object({
  id: z.string().max(120),
  opportunityCode: z.string().max(80),
  type: z.enum(["structure_fix", "conversion_fix", "page_addition", "design_alignment", "content_focus"]),
  priority: z.enum(["high", "medium", "low"]),
  scope: z.enum(["section", "route", "site"]),
  status: z.enum(["suggested", "accepted", "dismissed", "applied"]),
  derivedFrom: z.array(z.string().max(40)).max(8),
  recommendation: z.string().max(500),
  consultantLine: z.string().max(220).optional(),
  route: z.string().max(200).optional(),
  sectionId: z.string().max(120).optional(),
});

export type ImportRestructureQueueItem = z.infer<typeof ImportRestructureQueueItemSchema>;
