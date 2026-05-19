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

/** Invariants for executive-approved campaign sync: never schedule or platform-publish in this executor. */
export function assertSafeExecutiveCampaignSyncInput(input: SyncBentleyLaunchInput): void {
  if (input.postCreationMode !== "draft_unscheduled") {
    throw new Error("INVARIANT: executive campaign sync must use draft_unscheduled");
  }
  if (input.content360PlatformSchedule) {
    throw new Error("INVARIANT: executive campaign sync must not set content360PlatformSchedule");
  }
}
