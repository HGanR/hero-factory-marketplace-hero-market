import { z } from "zod";

export const ReferenceJurisdictionScope = z.enum(["FEDERAL", "STATE", "MULTI"]);

export const ReferenceTopic = z.enum([
  "GRANTOR_TRUST",
  "TRANSFER_TAX",
  "FIDUCIARY_INCOME_TAX",
  "CHARITABLE_501C3",
  "PRIVATE_FOUNDATION_CH42",
  "FORM_990",
  "FAMILY_OFFICE_RULE",
  "ENTITY_GOVERNANCE",
  "PRIVACY_CYBER",
]);

export const ReferenceItemSchema = z.object({
  id: z.string(),
  topic: ReferenceTopic,
  title: z.string(),
  summary: z.string(),
  scope: ReferenceJurisdictionScope,
  jurisdictions: z.array(z.string()).optional(),
  tags: z.array(z.string()).default([]),
  citations: z.array(
    z.object({
      label: z.string(),
      url: z.string().url().optional(),
    })
  ).default([]),
  checklist: z.array(z.string()).default([]),
  lastReviewedAt: z.string().optional(),
});

export type ReferenceItem = z.infer<typeof ReferenceItemSchema>;
