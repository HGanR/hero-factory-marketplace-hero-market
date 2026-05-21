import { z } from "zod";
import { ClaudeWebsiteIntakeSchema } from "@/lib/fulfillment/website-intake-types";
import {
  FULFILLMENT_ARTIFACT_SITE_BUILDER_PACKAGE,
  FULFILLMENT_PRIMARY_SERVICE_WEBSITE,
} from "@/lib/fulfillment/fulfillment-types";

export { ClaudeWebsiteIntakeSchema } from "@/lib/fulfillment/website-intake-types";

export const AdminManualPaymentConfirmBodySchema = z.object({
  clientId: z.string().uuid(),
  marketplaceUserId: z.number().int().positive().optional().nullable(),
  externalRef: z.string().trim().max(191).optional().nullable(),
  amountCents: z.number().int().nonnegative().optional().nullable(),
  currency: z.string().trim().length(3).optional().default("USD"),
  /** PayPal transaction note — desk reconciliation only; no PayPal API in v1. */
  paypalTransactionNote: z.string().trim().max(2000).optional().nullable(),
});

export const ClaudeFulfillmentHandoffBodySchema = z.object({
  version: z.literal("1").default("1"),
  client: z.object({
    clientId: z.string().uuid(),
    marketplaceUserId: z.number().int().positive().optional().nullable(),
    email: z.string().email().max(320).optional(),
    displayName: z.string().trim().max(500).optional(),
  }),
  service: z.object({
    primary: z.literal(FULFILLMENT_PRIMARY_SERVICE_WEBSITE),
    requested: z
      .array(z.literal(FULFILLMENT_PRIMARY_SERVICE_WEBSITE))
      .optional()
      .default(["WEBSITE"]),
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
    type: z.literal(FULFILLMENT_ARTIFACT_SITE_BUILDER_PACKAGE),
    title: z.string().trim().min(1).max(500),
    notes: z.string().trim().max(4000).optional().default(""),
    dueHint: z.string().trim().max(64).optional().nullable(),
  }),
  acknowledgements: z.object({
    noLegalAdvice: z.literal(true),
    noAutoFulfillment: z.literal(true),
    noAutoPublish: z.literal(true),
  }),
  metadata: z
    .object({
      claudeConversationId: z.string().trim().max(191).optional(),
      source: z.string().trim().max(64).optional(),
    })
    .optional(),
  /** Structured WEBSITE intake — Claude sales desk; optional with salesSummary fallback. */
  websiteIntake: ClaudeWebsiteIntakeSchema.optional(),
});
