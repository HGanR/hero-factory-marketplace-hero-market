/**
 * Zod payloads + sync safety checks for executive approvals (no `server-only` — safe in node:test).
 */

import { z } from "zod";
import type { SyncBentleyLaunchInput } from "@/lib/revenue-os/bentley-sync-launch-server";

export const CreateTodoPayloadSchema = z.object({
  clientId: z.string().uuid(),
  note: z.string().trim().min(1).max(50_000),
});

export const AssignFollowUpPayloadSchema = z.object({
  clientId: z.string().uuid(),
  title: z.string().trim().min(1).max(500),
  description: z.string().trim().max(20_000).optional().default(""),
  priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
  dueAt: z.string().max(64).optional().nullable(),
});

export const CreateSpecializedAgentPayloadSchema = z.object({
  templateKey: z.enum([
    "sales_follow_up",
    "client_onboarding",
    "credit_readiness",
    "website_builder",
    "social_media",
    "trust_intake",
    "support",
  ]),
  clientId: z.string().uuid().optional().nullable(),
  workspaceId: z.string().max(64).optional().nullable(),
});

export const TriggerBentleyAnalysisPayloadSchema = z
  .object({
    clientId: z.string().uuid().optional().nullable(),
    campaignId: z.string().uuid().optional().nullable(),
    mode: z.enum(["analysis", "market_sweep", "full_lifecycle"]),
    industry: z.string().trim().min(2).max(200).optional(),
    targetAudience: z.string().trim().max(400).optional(),
  })
  .refine((d) => d.mode !== "analysis" || Boolean(d.campaignId?.trim()), {
    message: "analysis mode requires campaignId",
    path: ["campaignId"],
  })
  .refine(
    (d) =>
      d.mode !== "market_sweep" ||
      (Boolean(d.industry && d.industry.trim().length >= 2) && Boolean(d.clientId?.trim())),
    { message: "market_sweep requires industry and clientId", path: ["industry"] },
  );

export const TriggerCampaignSyncPayloadSchema = z.object({
  campaignId: z.string().uuid(),
  dryRun: z.boolean().optional().default(false),
});

export const CreateSiteBuilderTaskPayloadSchema = z.object({
  clientId: z.string().uuid(),
  title: z.string().trim().min(1).max(500),
  instruction: z.string().trim().min(1).max(20_000),
  pageSlug: z.string().trim().max(191).optional().nullable(),
  priority: z.enum(["low", "normal", "high"]).optional().default("normal"),
});

/** TRUST fulfillment — internal legal-review packet note only (Slice 1). */
export const CreateTrustFulfillmentPacketPayloadSchema = z.object({
  clientId: z.string().uuid(),
  title: z.string().trim().min(1).max(500),
  packetMarkdown: z.string().trim().min(1).max(100_000),
  deliverableType: z.enum(["trust_review_packet", "smart_trust_setup_brief"]),
  priority: z.enum(["low", "normal", "high"]).optional().default("normal"),
  fulfillmentOrderId: z.string().uuid(),
  primaryService: z.literal("TRUST"),
});

/** REVENUE_OS fulfillment — internal campaign review packet (no publish or Content360 execution). */
export const CreateRevenueOsCampaignReviewPacketPayloadSchema = z.object({
  clientId: z.string().uuid(),
  campaignId: z.string().uuid(),
  title: z.string().trim().min(1).max(500),
  packetMarkdown: z.string().trim().min(1).max(100_000),
  deliverableType: z.literal("campaign_review_packet"),
  priority: z.enum(["low", "normal", "high"]).optional().default("normal"),
  fulfillmentOrderId: z.string().uuid(),
  primaryService: z.literal("REVENUE_OS"),
});

/** REVENUE_OS launch readiness checkpoint — owner approval record only; never triggers sync-launch. */
export const RecordRevenueOsLaunchReadinessPayloadSchema = z.object({
  clientId: z.string().uuid(),
  campaignId: z.string().uuid(),
  fulfillmentOrderId: z.string().uuid(),
  primaryService: z.literal("REVENUE_OS"),
  readinessSummary: z.string().trim().min(1).max(20_000),
  blockersResolved: z.array(z.string().trim().max(500)).max(30).optional().default([]),
  ownerAttestation: z.string().trim().min(1).max(2000),
});

/** SMART_TRUST governance review packet — internal note only (no trust execution). */
export const CreateSmartTrustGovernanceReviewPacketPayloadSchema = z.object({
  clientId: z.string().uuid(),
  trustId: z.string().uuid(),
  title: z.string().trim().min(1).max(500),
  packetMarkdown: z.string().trim().min(1).max(100_000),
  deliverableType: z.literal("governance_review_packet"),
  priority: z.enum(["low", "normal", "high"]).optional().default("normal"),
  fulfillmentOrderId: z.string().uuid(),
  primaryService: z.literal("SMART_TRUST"),
  governanceReviewRound: z.number().int().min(0).max(99),
});

/** SMART_TRUST resolution/minutes record — owner checkpoint only; no filing or signatures. */
/** Operational task delegation — owner-approved; target must accept (no autonomous acceptance). */
export const DelegateOperationalTaskPayloadSchema = z.object({
  taskId: z.string().uuid(),
  targetOperatorId: z.string().trim().min(1).max(64),
  rationale: z.string().trim().min(1).max(2000),
});

/** Operational task escalation — owner-approved; no autonomous escalation execution. */
export const EscalateOperationalTaskPayloadSchema = z.object({
  taskId: z.string().uuid(),
  targetOperatorId: z.string().trim().min(1).max(64),
  rationale: z.string().trim().min(1).max(2000),
  priority: z.enum(["normal", "high", "urgent"]).optional().default("high"),
});

export const RecordSmartTrustResolutionCheckpointPayloadSchema = z.object({
  clientId: z.string().uuid(),
  trustId: z.string().uuid(),
  fulfillmentOrderId: z.string().uuid(),
  primaryService: z.literal("SMART_TRUST"),
  resolutionId: z.string().uuid(),
  resolutionTitle: z.string().trim().min(1).max(500),
  minutesSummary: z.string().trim().min(1).max(20_000),
  recordMarkdown: z.string().trim().min(1).max(100_000),
  deliverableType: z.literal("trust_resolution_record"),
});

/** Invariants for executive-approved campaign sync: never schedule or platform-publish in this executor. */
export function assertSafeExecutiveCampaignSyncInput(input: SyncBentleyLaunchInput): void {
  if (input.postCreationMode !== "draft_unscheduled") {
    throw new Error("INVARIANT: executive campaign sync must use draft_unscheduled");
  }
  if (input.content360PlatformSchedule) {
    throw new Error("INVARIANT: executive campaign sync must not set content360PlatformSchedule");
  }
}
