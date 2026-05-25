import crypto from "crypto";
import { and, eq } from "drizzle-orm";

import {
  campaignAssets,
  campaignPosts,
  clientProviderConnections,
  providerPublishJobs,
} from "@/lib/db/schema";
import { getCampaignReviewerAccess } from "@/lib/revenue-os/get-campaign-reviewer-access";
import { assertCampaignClientMatchesRequest } from "@/lib/revenue-os/content360-schedule-guards";
import {
  buildContent360ScheduleIdempotencyKey,
  findActiveContent360ScheduleDuplicate,
  mergePayloadWithIdempotency,
} from "@/lib/revenue-os/content360-idempotency";
import { Content360Service } from "@/lib/social/providers/content360/content360-service";
import { CONTENT360_PROVIDER_ID } from "@/lib/social/providers/content360/content360-types";
import { mergeRawScheduledPublishMeta, parseScheduledPublishMeta } from "@/lib/social/scheduled-publish-meta";

export type ScheduleContent360PostInput = {
  userId: number;
  clientId: string;
  campaignId: string;
  campaignPostId: string;
  connectionId: string;
  scheduledAt: Date;
  timezone: string;
  targetPlatform: string;
  caption?: string | null;
  hashtags?: string | null;
  assetId?: string | null;
  providerPayloadJson?: Record<string, unknown> | null;
  /** When true, bypass active-slot duplicate detection (intentional reschedule). */
  forceReschedule?: boolean;
};

export type ScheduleContent360PostResult =
  | {
      ok: true;
      jobId: string;
      providerResponseJson: Record<string, unknown> | null;
      deduplicated?: boolean;
    }
  | { ok: false; error: string; status: number };

export { assertCampaignClientMatchesRequest };

export type PersistContent360ScheduleInput = {
  userId: number;
  clientId: string;
  campaignId: string;
  campaignPostId: string;
  batchId?: string | null;
  connectionId: string;
  scheduledAt: Date;
  timezone: string;
  targetPlatform: string;
  caption: string;
  hashtags: string | null | undefined;
  /** Value written to `campaign_posts.asset_id` after schedule. */
  assetIdForPost: string | null;
  postScheduledPublishMetaRaw: unknown;
  remote: {
    ok: boolean;
    simulated?: boolean;
    externalScheduleId?: string | null;
    externalPostId?: string | null;
    message?: string;
    raw?: Record<string, unknown>;
  };
  providerPayloadJson?: Record<string, unknown> | null;
  weeklyBatch?: boolean;
  content360BatchId?: string | null;
};

/**
 * Persists a `provider_publish_jobs` row and updates the campaign post for a Content360 schedule handshake.
 * Does not perform access checks or outbound scheduling — callers validate first.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function persistContent360ScheduleJobAndPost(
  db: any,
  input: PersistContent360ScheduleInput,
): Promise<{ jobId: string; providerResponseJson: Record<string, unknown> | null }> {
  const jobId = crypto.randomUUID();
  const providerResponseJson: Record<string, unknown> = {
    ...(input.remote.raw ?? {}),
    ok: input.remote.ok,
    simulated: input.remote.simulated === true,
    message: input.remote.message,
  };

  const prevMeta = parseScheduledPublishMeta(input.postScheduledPublishMetaRaw);
  const metaPatch = input.weeklyBatch
    ? {
        scheduledPublishSource: "bentley_weekly_batch" as const,
        publishRoute: "content360" as const,
        provider: CONTENT360_PROVIDER_ID,
        providerConnectionId: input.connectionId,
        providerPublishJobId: jobId,
        targetPlatform: input.targetPlatform,
        timezone: input.timezone,
        content360BatchId: (input.content360BatchId ?? input.batchId)?.trim() || undefined,
        weeklyBatch: true as const,
        externalScheduleId: input.remote.externalScheduleId ?? undefined,
        externalPostId: input.remote.externalPostId ?? undefined,
        providerStatus: input.remote.simulated ? "pending_remote_configuration" : input.remote.ok ? "submitted" : "provider_rejected",
      }
    : {
        scheduledPublishSource: prevMeta.scheduledPublishSource ?? "manual_schedule",
        publishRoute: "content360" as const,
        provider: CONTENT360_PROVIDER_ID,
        providerConnectionId: input.connectionId,
        providerPublishJobId: jobId,
        targetPlatform: input.targetPlatform,
        timezone: input.timezone,
        externalScheduleId: input.remote.externalScheduleId ?? undefined,
        externalPostId: input.remote.externalPostId ?? undefined,
        providerStatus: input.remote.simulated ? "pending_remote_configuration" : input.remote.ok ? "submitted" : "provider_rejected",
      };

  const nextScheduledPublishMeta = mergeRawScheduledPublishMeta(input.postScheduledPublishMetaRaw, metaPatch);

  await db.transaction(async (tx: any) => {
    await tx.insert(providerPublishJobs).values({
      id: jobId,
      userId: String(input.userId),
      clientId: input.clientId,
      campaignId: input.campaignId,
      campaignPostId: input.campaignPostId,
      batchId: input.batchId?.trim() || null,
      assetId: input.assetIdForPost,
      connectionId: input.connectionId,
      provider: CONTENT360_PROVIDER_ID,
      targetPlatform: input.targetPlatform,
      caption: input.caption,
      hashtags: input.hashtags,
      scheduledAt: input.scheduledAt,
      timezone: input.timezone,
      providerPayloadJson: input.providerPayloadJson ?? null,
      providerResponseJson,
      status: input.remote.ok ? "scheduled" : "failed",
      errorMessage: input.remote.ok ? null : input.remote.message ?? "Content360 schedule did not succeed",
      attempts: 0,
      lastAttemptAt: null,
      externalScheduleId: input.remote.externalScheduleId ?? null,
      externalPostId: input.remote.externalPostId ?? null,
    });

    await tx
      .update(campaignPosts)
      .set({
        scheduledAt: input.scheduledAt,
        status: "SCHEDULED",
        caption: input.caption,
        hashtags: input.hashtags,
        assetId: input.assetIdForPost,
        scheduledPublishMeta: nextScheduledPublishMeta,
        updatedAt: new Date(),
      })
      .where(eq(campaignPosts.id, input.campaignPostId));
  });

  return { jobId, providerResponseJson };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function scheduleContent360CampaignPost(db: any, input: ScheduleContent360PostInput): Promise<ScheduleContent360PostResult> {
  const access = await getCampaignReviewerAccess(db, input.userId, input.campaignId);
  if (!access) {
    return { ok: false, error: "Campaign not found or access denied", status: 404 };
  }

  const camp = access.campaign;
  const clientCheck = assertCampaignClientMatchesRequest({
    campaignClientId: camp.clientId,
    requestClientId: input.clientId,
  });
  if (!clientCheck.ok) {
    return { ok: false, error: clientCheck.error, status: clientCheck.status };
  }

  const connRows = await db
    .select()
    .from(clientProviderConnections)
    .where(
      and(
        eq(clientProviderConnections.id, input.connectionId),
        eq(clientProviderConnections.clientId, input.clientId),
        eq(clientProviderConnections.provider, CONTENT360_PROVIDER_ID)
      )
    )
    .limit(1);
  const connection = connRows[0];
  if (!connection) {
    return { ok: false, error: "Content360 connection not found for this client.", status: 404 };
  }

  const postRows = await db
    .select()
    .from(campaignPosts)
    .where(and(eq(campaignPosts.id, input.campaignPostId), eq(campaignPosts.campaignId, input.campaignId)))
    .limit(1);
  const post = postRows[0];
  if (!post) {
    return { ok: false, error: "Campaign post not found.", status: 404 };
  }

  if (post.status === "POSTED" || post.status === "POSTING") {
    return { ok: false, error: "Post is immutable (already published or publishing).", status: 400 };
  }

  if (input.assetId?.trim()) {
    const aid = input.assetId.trim();
    const assetRows = await db
      .select()
      .from(campaignAssets)
      .where(and(eq(campaignAssets.id, aid), eq(campaignAssets.campaignId, input.campaignId)))
      .limit(1);
    if (assetRows.length === 0) {
      return { ok: false, error: "assetId does not exist on this campaign.", status: 400 };
    }
  }

  const caption =
    typeof input.caption === "string" && input.caption.trim()
      ? input.caption.trim()
      : (post.caption ?? "").trim() || "(no caption)";

  const hashtags =
    input.hashtags === undefined || input.hashtags === null
      ? post.hashtags ?? null
      : input.hashtags === ""
        ? null
        : input.hashtags;

  const idempotencyKey = buildContent360ScheduleIdempotencyKey({
    campaignPostId: input.campaignPostId,
    provider: CONTENT360_PROVIDER_ID,
    scheduledAt: input.scheduledAt,
  });

  if (!input.forceReschedule) {
    const dup = await findActiveContent360ScheduleDuplicate(db, {
      clientId: input.clientId,
      campaignPostId: input.campaignPostId,
      provider: CONTENT360_PROVIDER_ID,
      scheduledAt: input.scheduledAt,
      idempotencyKey,
    });
    if (dup) {
      return {
        ok: true,
        jobId: dup.id,
        deduplicated: true,
        providerResponseJson: { deduplicated: true, idempotencyKey },
      };
    }
  }

  const jobPayload = mergePayloadWithIdempotency(input.providerPayloadJson ?? undefined, idempotencyKey);

  const service = new Content360Service();
  const schedulePayload: Record<string, unknown> = {
    campaignId: input.campaignId,
    campaignPostId: input.campaignPostId,
    scheduledAt: input.scheduledAt.toISOString(),
    timezone: input.timezone,
    targetPlatform: input.targetPlatform,
    caption,
    hashtags,
    assetId: input.assetId?.trim() || null,
    idempotencyKey,
    ...(input.providerPayloadJson ? { clientPayload: input.providerPayloadJson } : {}),
  };

  const remote = await service.schedulePost(connection, schedulePayload);
  const assetIdForPost = input.assetId?.trim() ? input.assetId.trim() : post.assetId;

  const { jobId, providerResponseJson } = await persistContent360ScheduleJobAndPost(db, {
    userId: input.userId,
    clientId: input.clientId,
    campaignId: input.campaignId,
    campaignPostId: input.campaignPostId,
    connectionId: input.connectionId,
    scheduledAt: input.scheduledAt,
    timezone: input.timezone,
    targetPlatform: input.targetPlatform,
    caption,
    hashtags,
    assetIdForPost,
    postScheduledPublishMetaRaw: post.scheduledPublishMeta,
    remote,
    providerPayloadJson: jobPayload,
    weeklyBatch: false,
  });

  return { ok: true, jobId, providerResponseJson };
}
