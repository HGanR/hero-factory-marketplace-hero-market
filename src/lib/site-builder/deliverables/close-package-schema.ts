/**
 * Structured close / onboarding model — derived deterministically from deliverables + safe schema metadata.
 * Not a CRM; safe for export and client-adjacent artifacts.
 */

import { z } from "zod";

export const ProposalTierSchema = z.enum(["essential", "standard", "partner"]);
export const ScopePostureSchema = z.enum(["starter", "core", "expanded"]);

export const ProposalSelectionSchema = z.object({
  selectedTier: ProposalTierSchema.optional(),
  scopePosture: ScopePostureSchema.optional(),
  notes: z.string().max(2000).optional(),
  /** Reserved for future checkout wiring — optional preference only. */
  paymentHandoffPreference: z.enum(["deposit", "full", "flexible"]).optional(),
});

export type ProposalSelection = z.infer<typeof ProposalSelectionSchema>;

export const ApprovalSummarySchema = z.object({
  projectName: z.string().max(300),
  summary: z.string().max(6000),
  includedOutcomes: z.array(z.string().max(800)).max(24),
  deploymentTarget: z.string().max(400).optional(),
  widgetIncluded: z.boolean(),
});

export const OnboardingChecklistSectionSchema = z.object({
  label: z.string().max(160),
  items: z.array(z.string().max(500)).max(32),
});

export const KickoffPacketSchema = z.object({
  nextSteps: z.array(z.string().max(500)).max(24),
  clientInputsNeeded: z.array(z.string().max(500)).max(24),
  consultantActions: z.array(z.string().max(500)).max(24),
});

export const PaymentReadinessPlaceholdersSchema = z.object({
  approvalLinkPlaceholder: z.literal("{approval_link}"),
  invoiceLinkPlaceholder: z.literal("{invoice_link}"),
  kickoffLinkPlaceholder: z.literal("{kickoff_link}"),
  stripeLinkPlaceholder: z.literal("{stripe_payment_link}"),
  cryptoLinkPlaceholder: z.literal("{crypto_payment_link}"),
  depositOrFullNote: z.string().max(400),
});

export const ClosePackageModelSchema = z.object({
  proposalSelection: ProposalSelectionSchema,
  approvalSummary: ApprovalSummarySchema,
  onboardingChecklist: z.array(OnboardingChecklistSectionSchema).max(16),
  kickoffPacket: KickoffPacketSchema,
  paymentReadiness: PaymentReadinessPlaceholdersSchema,
});

export type ClosePackageModel = z.infer<typeof ClosePackageModelSchema>;
