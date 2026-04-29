import { z } from "zod";

/**
 * Rich content plan for generation + repair (Variant Engine v3 — Content Intelligence).
 */
export const ContentBriefSchema = z.object({
  businessType: z.string().max(120).optional(),
  industry: z.string().max(200).optional(),
  audience: z.string().max(400).optional(),
  primaryOffer: z.string().max(800).optional(),
  painPoints: z.array(z.string().max(200)).default([]),
  desiredOutcome: z.string().max(500).optional(),
  tone: z.string().max(200).optional(),
  trustSignals: z.array(z.string().max(200)).default([]),
  conversionGoal: z.string().max(500).optional(),
  ctaPrimary: z.string().max(120).optional(),
  ctaSecondary: z.string().max(120).optional(),
  keywordTargets: z.array(z.string().max(64)).default([]),
});

export type ContentBrief = z.infer<typeof ContentBriefSchema>;
