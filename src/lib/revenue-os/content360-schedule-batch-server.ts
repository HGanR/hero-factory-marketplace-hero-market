import crypto from "crypto";
import { and, eq, inArray } from "drizzle-orm";

import {
  campaignAssets,
  campaignPosts,
  clientProviderConnections,
  providerPublishBatches,
  type CampaignPostRow,
} from "@/lib/db/schema";
import { getCampaignReviewerAccess } from "@/lib/revenue-os/get-campaign-reviewer-access";
import {
  assertCampaignClientMatchesRequest,
  persistContent360ScheduleJobAndPost,
} from "@/lib/revenue-os/content360-schedule-server";
import {
  buildContent360ScheduleIdempotencyKey,
  findActiveContent360ScheduleDuplicate,
  mergePayloadWithIdempotency,
} from "@/lib/revenue-os/content360-idempotency";
import { Content360Service } from "@/lib/social/providers/content360/content360-service";
import { CONTENT360_PROVIDER_ID } from "@/lib/social/providers/content360/content360-types";

export type ScheduleContent360BatchPostItem = {
  campaignPostId: string;
  assetId?: string | null;
  targetPlatform: string;
  scheduledAt: string;
  caption?: string | null;
  hashtags?: string | null;
};

export type ScheduleContent360BatchInput = {
  userId: number;
  clientId: string;
  campaignId: string;
  connectionId: string;
  timezone: string;
  posts: ScheduleContent360BatchPostItem[];
  forceReschedule?: boolean;
};

export type ScheduleContent360BatchOkResult = {
  ok: true;
  batchId: string;
  totalPosts: number;
  scheduledCount: number;
  failedCount: number;
  skippedDuplicates: number;
  batchStatus: "completed" | "partial" | "failed";
  usedBatchEndpoint: boolean;
  providerBatchId: string | null;
  results: Array<{
    campaignPostId: string;
    jobId: string;
    providerOk: boolean;
    skippedDuplicate?: boolean;
  }>;
};

export type ScheduleContent360BatchResult = ScheduleContent360BatchOkResult | { ok: false; error: string; status: number };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function scheduleContent360Batch(db: any, input: ScheduleContent360BatchInput): Promise<ScheduleContent360BatchResult> {
  if (!input.posts.length) {
    return { ok: false, error: "posts must be a non-empty array", status: 400 };
  }
  if (input.posts.length > 200) {
    return { ok: false, error: "Too many posts in one batch (max 200).", status: 400 };
  }

  const postIds = input.posts.map((p) => p.campaignPostId);
  if (new Set(postIds).size !== postIds.length) {
    return { ok: false, error: "Duplicate campaignPostId in posts array.", status: 400 };
  }

  const access = await getCampaignReviewerAccess(db, input.userId, input.campaignId);
  if (!access) {
    return { ok: false, error: "Campaign not found or access denied", status: 404 };
  }

  const clientCheck = assertCampaignClientMatchesRequest({
    campaignClientId: access.campaign.clientId,
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

  const postRows: CampaignPostRow[] = await db
    .select()
    .from(campaignPosts)
    .where(and(eq(campaignPosts.campaignId, input.campaignId), inArray(campaignPosts.id, postIds)));
  if (postRows.length !== postIds.length) {
    return { ok: false, error: "One or more campaign posts were not found on this campaign.", status: 400 };
  }

  const byPostId = new Map<string, CampaignPostRow>(postRows.map((r) => [r.id, r]));

  for (const p of input.posts) {
    const row = byPostId.get(p.campaignPostId);
    if (!row) continue;
    if (row.status === "POSTED" || row.status === "POSTING") {
      return {
        ok: false,
        error: `Post ${p.campaignPostId} is immutable (already published or publishing).`,
        status: 400,
      };
    }
  }

  const assetIdsToCheck = new Set<string>();
  for (const p of input.posts) {
    const aid = typeof p.assetId === "string" && p.assetId.trim() ? p.assetId.trim() : "";
    if (aid) assetIdsToCheck.add(aid);
  }
  if (assetIdsToCheck.size > 0) {
    const assets = await db
      .select()
      .from(campaignAssets)
      .where(and(eq(campaignAssets.campaignId, input.campaignId), inArray(campaignAssets.id, [...assetIdsToCheck])));
    if (assets.length !== assetIdsToCheck.size) {
      return { ok: false, error: "One or more assetId values are not valid for this campaign.", status: 400 };
    }
  }

  const tz = input.timezone.trim();

  for (const item of input.posts) {
    const d = new Date(item.scheduledAt);
    if (Number.isNaN(d.getTime())) {
      return { ok: false, error: `Invalid scheduledAt for post ${item.campaignPostId}`, status: 400 };
    }
  }

  type PlannedEntry = {
    item: ScheduleContent360BatchPostItem;
    svc: {
      campaignPostId: string;
      scheduledAt: string;
      targetPlatform: string;
      caption: string;
      hashtags: string | null;
      assetId: string | null;
    };
    scheduledAt: Date;
    idempotencyKey: string;
  };

  const preResults: Array<{
    campaignPostId: string;
    jobId: string;
    providerOk: boolean;
    skippedDuplicate?: boolean;
  }> = [];
  const planned: PlannedEntry[] = [];

  for (const item of input.posts) {
    const post = byPostId.get(item.campaignPostId)!;
    const scheduledAt = new Date(item.scheduledAt);
    const caption =
      typeof item.caption === "string" && item.caption.trim()
        ? item.caption.trim()
        : (post.caption ?? "").trim() || "(no caption)";
    const hashtags =
      item.hashtags === undefined || item.hashtags === null
        ? post.hashtags ?? null
        : item.hashtags === ""
          ? null
        : item.hashtags;
    const assetIdForPayload =
      typeof item.assetId === "string" && item.assetId.trim() ? item.assetId.trim() : post.assetId ?? null;

    const idempotencyKey = buildContent360ScheduleIdempotencyKey({
      campaignPostId: item.campaignPostId,
      provider: CONTENT360_PROVIDER_ID,
      scheduledAt,
    });

    if (!input.forceReschedule) {
      const dup = await findActiveContent360ScheduleDuplicate(db, {
        clientId: input.clientId,
        campaignPostId: item.campaignPostId,
        provider: CONTENT360_PROVIDER_ID,
        scheduledAt,
        idempotencyKey,
      });
      if (dup) {
        preResults.push({ campaignPostId: item.campaignPostId, jobId: dup.id, providerOk: true, skippedDuplicate: true });
        continue;
      }
    }

    planned.push({
      item,
      scheduledAt,
      idempotencyKey,
      svc: {
        campaignPostId: item.campaignPostId,
        scheduledAt: scheduledAt.toISOString(),
        targetPlatform: item.targetPlatform.trim(),
        caption,
        hashtags,
        assetId: assetIdForPayload,
      },
    });
  }

  if (planned.length === 0) {
    return {
      ok: false,
      error:
        "Nothing new to schedule — each post already has an active Content360 job for the selected time(s). Use forceReschedule to bypass.",
      status: 409,
    };
  }

  const batchId = crypto.randomUUID();

  await db.insert(providerPublishBatches).values({
    id: batchId,
    userId: String(input.userId),
    clientId: input.clientId,
    campaignId: input.campaignId,
    provider: CONTENT360_PROVIDER_ID,
    connectionId: input.connectionId,
    status: "processing",
    totalPosts: planned.length,
    scheduledCount: 0,
    failedCount: 0,
    timezone: tz,
    providerBatchId: null,
    providerResponseJson: null,
  });

  const service = new Content360Service();

  let remote;
  try {
    remote = await service.scheduleBatch(connection, {
      campaignId: input.campaignId,
      timezone: tz,
      posts: planned.map((p) => p.svc),
    });
  } catch (e) {
    await db
      .update(providerPublishBatches)
      .set({
        status: "failed",
        scheduledCount: 0,
        failedCount: planned.length,
        providerResponseJson: { error: String(e) },
        updatedAt: new Date(),
      })
      .where(eq(providerPublishBatches.id, batchId));
    return { ok: false, error: "Content360 batch scheduling failed unexpectedly.", status: 502 };
  }

  const remoteById = new Map(remote.items.map((i) => [i.campaignPostId, i]));
  const results: Array<{
    campaignPostId: string;
    jobId: string;
    providerOk: boolean;
    skippedDuplicate?: boolean;
  }> = [...preResults];
  let scheduledCount = 0;
  let failedCount = 0;

  for (let i = 0; i < planned.length; i++) {
    const row = planned[i]!;
    const post = byPostId.get(row.item.campaignPostId)!;
    const svc = row.svc;
    const r = remoteById.get(row.item.campaignPostId);
    const remoteRow = r ?? {
      campaignPostId: row.item.campaignPostId,
      ok: false,
      simulated: false,
      message: "Missing provider result for this post",
    };

    const assetIdForPost = svc.assetId;

    const jobPayload = mergePayloadWithIdempotency({ weeklyBatch: true, batchIndex: i, batchId }, row.idempotencyKey);

    const { jobId } = await persistContent360ScheduleJobAndPost(db, {
      userId: input.userId,
      clientId: input.clientId,
      campaignId: input.campaignId,
      campaignPostId: row.item.campaignPostId,
      batchId,
      connectionId: input.connectionId,
      scheduledAt: row.scheduledAt,
      timezone: tz,
      targetPlatform: svc.targetPlatform,
      caption: svc.caption,
      hashtags: svc.hashtags,
      assetIdForPost,
      postScheduledPublishMetaRaw: post.scheduledPublishMeta,
      remote: remoteRow,
      providerPayloadJson: jobPayload,
      weeklyBatch: true,
      content360BatchId: batchId,
    });

    results.push({ campaignPostId: row.item.campaignPostId, jobId, providerOk: Boolean(remoteRow.ok) });
    if (remoteRow.ok) scheduledCount += 1;
    else failedCount += 1;
  }

  const skippedDuplicates = preResults.filter((r) => r.skippedDuplicate).length;

  const batchStatus: ScheduleContent360BatchOkResult["batchStatus"] =
    failedCount === 0 ? "completed" : scheduledCount === 0 ? "failed" : "partial";

  const summaryJson: Record<string, unknown> = {
    usedBatchEndpoint: remote.usedBatchEndpoint,
    totalPosts: planned.length,
    skippedDuplicates,
    scheduledCount,
    failedCount,
    batchStatus,
  };

  await db
    .update(providerPublishBatches)
    .set({
      status: batchStatus === "completed" ? "completed" : batchStatus === "failed" ? "failed" : "partial",
      scheduledCount,
      failedCount,
      providerBatchId: remote.providerBatchId ?? null,
      providerResponseJson: { ...summaryJson, providerRaw: remote.raw ?? null },
      updatedAt: new Date(),
    })
    .where(eq(providerPublishBatches.id, batchId));

  return {
    ok: true,
    batchId,
    totalPosts: planned.length,
    scheduledCount,
    failedCount,
    skippedDuplicates,
    batchStatus,
    usedBatchEndpoint: remote.usedBatchEndpoint,
    providerBatchId: remote.providerBatchId ?? null,
    results,
  };
}
