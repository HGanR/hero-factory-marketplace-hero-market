import { z } from "zod";
import { US_STATE_CODES, PersonSchema } from "@/lib/irrevocableTrust/schema";

export const RevocableStepSchemas = {
  state: z.object({ governingState: z.enum(US_STATE_CODES), county: z.string().optional(), proposedEffectiveDate: z.string().min(4) }),
  parties: z.object({ settlor: PersonSchema, initialTrustees: z.array(PersonSchema).min(1), successorTrustees: z.array(PersonSchema).default([]), beneficiaries: z.array(PersonSchema).min(1) }),
  terms: z.object({ trustName: z.string().min(1), revocationAndAmendmentNotes: z.string().min(1), incapacityInstructions: z.string().optional(), distributionInstructions: z.string().min(1) }),
  funding: z.object({ assetSchedule: z.string().min(1), transferPlanAcknowledged: z.boolean() }),
  review: z.object({ confirmAccuracy: z.literal(true), confirmProfessionalReview: z.literal(true) }),
} as const;
export type RevocableStepKey = keyof typeof RevocableStepSchemas;
