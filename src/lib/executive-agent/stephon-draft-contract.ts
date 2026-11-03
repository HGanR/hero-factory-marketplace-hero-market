import { z } from 'zod';

/** V1 targets an existing owned, client-linked DRAFT site; never creates/publishes a live site. */
export const GenerateStephonDraftSchema = z.object({
  clientId: z.string().uuid(),
  siteId: z.string().uuid(),
  input: z.object({
    siteType:z.enum(['auto','landing','portfolio','saas','web3_product','community','ecommerce_light','local_business','trust_operator']).default('auto'),
    userPrompt:z.string().trim().min(1).max(8000),
    industry:z.string().max(200).optional(),businessName:z.string().max(200).optional(),
    primaryOffer:z.string().max(800).optional(),audience:z.string().max(800).optional(),
    designDirection:z.enum(['minimal','bold','luxe','cyber','operator']).optional(),
    statedConversionGoal:z.string().max(500).optional(),statedBrandTone:z.string().max(400).optional(),
    statedDesignPreference:z.string().max(400).optional(),statedTrustAndProof:z.string().max(1200).optional(),
  }).strict(),
  generationMode: z.enum(['deterministic', 'configured']).default('deterministic'),
}).strict();
export type GenerateStephonDraftInput = z.infer<typeof GenerateStephonDraftSchema>;
