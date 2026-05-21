import { z } from "zod";
import { ClaudeTrustIntakeSchema } from "@/lib/fulfillment/trust-intake-types";
import {
  FULFILLMENT_ARTIFACT_SMART_TRUST_SETUP_BRIEF,
  FULFILLMENT_ARTIFACT_TRUST_REVIEW_PACKET,
  FULFILLMENT_PRIMARY_SERVICE_TRUST,
} from "@/lib/fulfillment/fulfillment-types";

export { ClaudeTrustIntakeSchema } from "@/lib/fulfillment/trust-intake-types";

const TrustAcknowledgementsSchema = z.object({
  noLegalAdvice: z.literal(true),
  noAutoFulfillment: z.literal(true),
  noAutoPublish: z.literal(true),
  noFinalLegalDocument: z.literal(true),
  preparedForLegalReview: z.literal(true),
  recommendAttorneyReview: z.literal(true),
});

const TrustDeliverableTypeSchema = z.union([
  z.literal(FULFILLMENT_ARTIFACT_TRUST_REVIEW_PACKET),
  z.literal(FULFILLMENT_ARTIFACT_SMART_TRUST_SETUP_BRIEF),
]);

export const ClaudeTrustFulfillmentHandoffBodySchema = z.object({
  version: z.literal("1").default("1"),
  client: z.object({
    clientId: z.string().uuid(),
    marketplaceUserId: z.number().int().positive().optional().nullable(),
    email: z.string().email().max(320).optional(),
    displayName: z.string().trim().max(500).optional(),
  }),
  service: z.object({
    primary: z.literal(FULFILLMENT_PRIMARY_SERVICE_TRUST),
    requested: z
      .array(z.literal(FULFILLMENT_PRIMARY_SERVICE_TRUST))
      .optional()
      .default(["TRUST"]),
  }),
  payment: z.object({
    confirmationId: z.string().uuid(),
    externalRef: z.string().trim().max(191).optional().nullable(),
  }),
  consent: z
    .object({
      emailMarketing: z.boolean().optional(),
      sms: z.boolean().optional(),
      smsOptOut: z.boolean().optional(),
      emailOptOut: z.boolean().optional(),
      capturedAt: z.string().max(64).optional(),
    })
    .optional(),
  salesSummary: z.object({
    text: z.string().trim().min(1).max(8000),
    language: z.string().trim().max(16).optional().default("en"),
    channel: z.enum(["email", "sms", "chat"]).optional().default("chat"),
  }),
  requestedDeliverable: z.object({
    type: TrustDeliverableTypeSchema,
    title: z.string().trim().min(1).max(500),
    notes: z.string().trim().max(4000).optional().default(""),
    dueHint: z.string().trim().max(64).optional().nullable(),
  }),
  acknowledgements: TrustAcknowledgementsSchema,
  metadata: z
    .object({
      claudeConversationId: z.string().trim().max(191).optional(),
      source: z.string().trim().max(64).optional(),
    })
    .optional(),
  trustIntake: ClaudeTrustIntakeSchema.optional(),
});
