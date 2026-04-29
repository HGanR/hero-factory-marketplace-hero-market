import { z } from "zod";

/**
 * Zod schema for trust knowledge and NPC outputs.
 * Use for validation, typed knowledge ingestion, and structured LLM responses.
 */

export const KnowledgeCategorySchema = z.enum([
  "world",
  "business",
  "product",
  "navigation",
  "general",
]);

export const KnowledgeEntrySchema = z.object({
  topic: z.string().min(1).max(200),
  keywords: z.array(z.string().min(1).max(80)).min(1).max(30),
  content: z.string().min(1).max(10000),
  priority: z.number().int().min(0).max(10),
  category: KnowledgeCategorySchema,
});

export type KnowledgeEntryValidated = z.infer<typeof KnowledgeEntrySchema>;

export const TrustTypeSchema = z.enum([
  "revocable",
  "irrevocable_grantor",
  "irrevocable_non_grantor",
  "spendthrift",
  "dynasty",
  "IDGT",
  "SLAT",
  "DAPT",
  "directed",
  "ecclesiastical",
  "private",
]);

export const UserTrustObjectiveSchema = z.enum([
  "probate_avoidance",
  "asset_protection",
  "estate_tax_planning",
  "medicaid_planning",
  "business_succession",
  "dynasty_wealth",
  "income_splitting",
  "incapacity_planning",
  "creditor_protection_beneficiary",
  "unknown",
]);

export const JurisdictionSchema = z.object({
  type: z.enum(["domestic", "offshore", "unknown"]),
  stateOrCountry: z.string().optional(),
  notes: z.string().optional(),
});

export const NPCResponseContextSchema = z.object({
  jurisdiction: JurisdictionSchema.optional(),
  objective: UserTrustObjectiveSchema.optional(),
  riskTolerance: z.enum(["low", "medium", "high", "unknown"]).optional(),
  suggestedTrustType: TrustTypeSchema.optional(),
  nextSteps: z.array(z.string()).optional(),
  disclaimerRequired: z.boolean().default(true),
});

export type NPCResponseContext = z.infer<typeof NPCResponseContextSchema>;

/** Structured response shape for Trust NPC – can guide LLM output format. */
export const TrustNPCStructuredResponseSchema = z.object({
  summary: z.string().max(500),
  trustTypeRecommendations: z
    .array(
      z.object({
        type: TrustTypeSchema,
        label: z.string(),
        fitReason: z.string(),
        considerations: z.array(z.string()),
      })
    )
    .optional(),
  nextActions: z.array(z.string()).optional(),
  disclaimer: z.string().optional(),
});

export type TrustNPCStructuredResponse = z.infer<
  typeof TrustNPCStructuredResponseSchema
>;

/** Validate a raw object against KnowledgeEntry schema. */
export function validateKnowledgeEntry(
  raw: unknown
): { success: true; data: KnowledgeEntryValidated } | { success: false; error: z.ZodError } {
  const result = KnowledgeEntrySchema.safeParse(raw);
  if (result.success) return { success: true, data: result.data };
  return { success: false, error: result.error };
}

/** Parse and validate an array of knowledge entries. */
export function validateKnowledgeEntries(
  raw: unknown
): KnowledgeEntryValidated[] {
  const arr = z.array(KnowledgeEntrySchema).safeParse(raw);
  if (!arr.success) return [];
  return arr.data;
}
