import crypto from "crypto";
import { and, eq, inArray, notInArray } from "drizzle-orm";

import {
  campaignPosts,
  clientProviderConnections,
  providerPublishBatches,
  providerPublishJobs,
} from "@/lib/db/schema";
import { getCampaignReviewerAccess } from "@/lib/revenue-os/get-campaign-reviewer-access";
import { assertCampaignClientMatchesRequest } from "@/lib/revenue-os/content360-schedule-guards";
import {
  buildContent360ScheduleIdempotencyKey,
  mergePayloadWithIdempotency,
} from "@/lib/revenue-os/content360-idempotency";
import { Content360Service } from "@/lib/social/providers/content360/content360-service";
import { CONTENT360_PROVIDER_ID } from "@/lib/social/providers/content360/content360-types";
import { mergeRawScheduledPublishMeta, parseScheduledPublishMeta } from "@/lib/social/scheduled-publish-meta";

type OwnedBatch = {
  batch: typeof providerPublishBatches.$inferSelect;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function loadOwnedContent360Batch(
  db: any,
  input: { userId: number; clientId: string; batchId: string },
): Promise<OwnedBatch | null> {
  const rows = await db
    .select()
    .from(providerPublishBatches)
    .where(
      and(
        eq(providerPublishBatches.id, input.batchId),
        eq(providerPublishBatches.clientId, input.clientId),
        eq(providerPublishBatches.provider, CONTENT360_PROVIDER_ID),
      ),
    )
    .limit(1);
  const batch = rows[0];
  if (!batch) return null;

  const access = await getCampaignReviewerAccess(db, input.userId, batch.campaignId);
  if (!access) return null;

  const clientCheck = assertCampaignClientMatchesRequest({
    campaignClientId: access.campaign.clientId,
    requestClientId: input.clientId,
  });
  if (!clientCheck.ok) return null;

  return { batch };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function refreshBatchAggregateStats(db: any, batchId: string): Promise<void> {
  const jobs = await db
    .select({ status: providerPublishJobs.status })
    .from(providerPublishJobs)
    .where(eq(providerPublishJobs.batchId, batchId));

  if (!jobs.length) {
    await db
      .update(providerPublishBatches)
      .set({
        totalPosts: 0,
        scheduledCount: 0,
        failedCount: 0,
        status: "failed",
        updatedAt: new Date(),
      })
      .where(eq(providerPublishBatches.id, batchId));
    return;
  }

  let scheduledLike = 0;
  let failedLike = 0;
  let publishedLike = 0;
  for (const j of jobs) {
    const s = String(j.status ?? "");
    if (s === "published") publishedLike += 1;
    else if (s === "failed" || s === "disconnected_provider") failedLike += 1;
    else if (s === "scheduled" || s === "queued") scheduledLike += 1;
  }

  const allCanceled = jobs.every((j) => {
    const s = String(j.status ?? "");
    return s === "canceled" || s === "disconnected_provider";
  });
  const allPublished = jobs.every((j) => String(j.status ?? "") === "published");

  let batchStatus: string;
  if (allPublished) batchStatus = "completed";
  else if (allCanceled) batchStatus = "canceled";
  else if (failedLike > 0 && scheduledLike + publishedLike === 0) batchStatus = "failed";
  else if (failedLike > 0) batchStatus = "partial";
  else batchStatus = "completed";

  await db
    .update(providerPublishBatches)
    .set({
      totalPosts: jobs.length,
      scheduledCount: scheduledLike + publishedLike,
      failedCount: failedLike,
      status: batchStatus,
      updatedAt: new Date(),
    })
    .where(eq(providerPublishBatches.id, batchId));
}

export type RetryFailedBatchResult =
  | { ok: true; retried: number; skipped: number; batchId: string }
  | { ok: false; error: string; status: number };

/**
 * Requeues failed jobs in a batch. Jobs with an external schedule id are re-queued for worker sync only.
 * Jobs without a remote schedule id are re-submitted to Content360 schedule once.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function retryFailedContent360BatchJobs(
  db: any,
  input: { userId: number; clientId: string; batchId: string },
): Promise<RetryFailedBatchResult> {
  const owned = await loadOwnedContent360Batch(db, input);
  if (!owned) {
    return { ok: false, error: "Batch not found or access denied.", status: 404 };
  }

  const connRows = await db
    .select()
    .from(clientProviderConnections)
    .where(
      and(
        eq(clientProviderConnections.id, owned.batch.connectionId),
        eq(clientProviderConnections.clientId, input.clientId),
        eq(clientProviderConnections.provider, CONTENT360_PROVIDER_ID),
      ),
    )
    .limit(1);
  const connection = connRows[0];
  if (!connection) {
    return { ok: false, error: "Content360 connection for this batch no longer exists.", status: 400 };
  }

  const failedJobs = await db
    .select()
    .from(providerPublishJobs)
    .where(
      and(
        eq(providerPublishJobs.batchId, input.batchId),
        eq(providerPublishJobs.clientId, input.clientId),
        eq(providerPublishJobs.provider, CONTENT360_PROVIDER_ID),
        eq(providerPublishJobs.status, "failed"),
      ),
    );

  if (!failedJobs.length) {
    return { ok: true, retried: 0, skipped: 0, batchId: input.batchId };
  }

  const service = new Content360Service();
  let retried = 0;
  let skipped = 0;

  for (const job of failedJobs) {
    const ext = job.externalScheduleId?.trim();
    if (ext) {
      await db
        .update(providerPublishJobs)
        .set({
          status: "queued",
          errorMessage: null,
          updatedAt: new Date(),
        })
        .where(eq(providerPublishJobs.id, job.id));

      const postRows = await db.select().from(campaignPosts).where(eq(campaignPosts.id, job.campaignPostId)).limit(1);
      const post = postRows[0];
      if (post && parseScheduledPublishMeta(post.scheduledPublishMeta).publishRoute === "content360") {
        await db
          .update(campaignPosts)
          .set({
            status: "SCHEDULED",
            errorMessage: null,
            scheduledPublishMeta: mergeRawScheduledPublishMeta(post.scheduledPublishMeta, {
              providerStatus: "manual_retry_queued",
            }) as never,
            updatedAt: new Date(),
          })
          .where(eq(campaignPosts.id, post.id));
      }
      retried += 1;
      continue;
    }

    const postRows = await db.select().from(campaignPosts).where(eq(campaignPosts.id, job.campaignPostId)).limit(1);
    const post = postRows[0];
    if (!post || post.campaignId !== job.campaignId) {
      skipped += 1;
      continue;
    }

    const scheduledAt = job.scheduledAt instanceof Date ? job.scheduledAt : new Date(String(job.scheduledAt));
    const retryNonce = crypto.randomUUID();
    const idemKey = `${buildContent360ScheduleIdempotencyKey({
      campaignPostId: job.campaignPostId,
      provider: CONTENT360_PROVIDER_ID,
      scheduledAt,
    })}:retry:${retryNonce}`;

    const schedulePayload: Record<string, unknown> = {
      campaignId: job.campaignId,
      campaignPostId: job.campaignPostId,
      scheduledAt: scheduledAt.toISOString(),
      timezone: job.timezone,
      targetPlatform: job.targetPlatform,
      caption: job.caption,
      hashtags: job.hashtags,
      assetId: job.assetId,
      idempotencyKey: idemKey,
    };

    const remote = await service.schedulePost(connection, schedulePayload);
    const providerResponseJson = {
      ...(remote.raw ?? {}),
      ok: remote.ok,
      simulated: remote.simulated === true,
      message: remote.message,
      retryNonce,
    };

    await db
      .update(providerPublishJobs)
      .set({
        status: remote.ok ? "scheduled" : "failed",
        errorMessage: remote.ok ? null : remote.message ?? "Content360 reschedule did not succeed",
        externalScheduleId: remote.externalScheduleId ?? null,
        externalPostId: remote.externalPostId ?? null,
        providerPayloadJson: mergePayloadWithIdempotency(
          (job.providerPayloadJson as Record<string, unknown> | null) ?? undefined,
          idemKey,
        ) as never,
        providerResponseJson: providerResponseJson as never,
        updatedAt: new Date(),
      })
      .where(eq(providerPublishJobs.id, job.id));

    if (parseScheduledPublishMeta(post.scheduledPublishMeta).publishRoute === "content360") {
      await db
        .update(campaignPosts)
        .set({
          status: "SCHEDULED",
          scheduledPublishMeta: mergeRawScheduledPublishMeta(post.scheduledPublishMeta, {
            externalScheduleId: remote.externalScheduleId ?? undefined,
            externalPostId: remote.externalPostId ?? undefined,
            providerStatus: remote.ok ? "submitted" : "provider_rejected",
            content360ScheduleCanceled: false,
          }) as never,
          updatedAt: new Date(),
        })
        .where(eq(campaignPosts.id, post.id));
    }

    if (remote.ok) retried += 1;
    else skipped += 1;
  }

  await refreshBatchAggregateStats(db, input.batchId);
  return { ok: true, retried, skipped, batchId: input.batchId };
}

export type CancelBatchResult = { ok: true; canceled: number; batchId: string } | { ok: false; error: string; status: number };

/**
 * Cancels non-published jobs in a batch, best-effort remote cancel when an external schedule id exists.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function cancelContent360BatchJobs(
  db: any,
  input: { userId: number; clientId: string; batchId: string },
): Promise<CancelBatchResult> {
  const owned = await loadOwnedContent360Batch(db, input);
  if (!owned) {
    return { ok: false, error: "Batch not found or access denied.", status: 404 };
  }

  const connRows = await db
    .select()
    .from(clientProviderConnections)
    .where(
      and(
        eq(clientProviderConnections.id, owned.batch.connectionId),
        eq(clientProviderConnections.clientId, input.clientId),
        eq(clientProviderConnections.provider, CONTENT360_PROVIDER_ID),
      ),
    )
    .limit(1);
  const connection = connRows[0];
  const service = new Content360Service();

  const jobs = await db
    .select()
    .from(providerPublishJobs)
    .where(
      and(
        eq(providerPublishJobs.batchId, input.batchId),
        eq(providerPublishJobs.clientId, input.clientId),
        eq(providerPublishJobs.provider, CONTENT360_PROVIDER_ID),
        notInArray(providerPublishJobs.status, ["published", "canceled", "disconnected_provider"]),
      ),
    );

  let canceled = 0;
  for (const job of jobs) {
    const st = String(job.status ?? "");
    if (st === "canceled" || st === "disconnected_provider") continue;

    const ext = job.externalScheduleId?.trim();
    if (ext && connection) {
      await service.cancelScheduledPost(connection, ext);
    }

    await db
      .update(providerPublishJobs)
      .set({
        status: "canceled",
        errorMessage: "Canceled via batch cancel.",
        updatedAt: new Date(),
      })
      .where(eq(providerPublishJobs.id, job.id));

    const postRows = await db.select().from(campaignPosts).where(eq(campaignPosts.id, job.campaignPostId)).limit(1);
    const post = postRows[0];
    if (post && parseScheduledPublishMeta(post.scheduledPublishMeta).publishRoute === "content360") {
      await db
        .update(campaignPosts)
        .set({
          scheduledPublishMeta: mergeRawScheduledPublishMeta(post.scheduledPublishMeta, {
            providerStatus: "canceled",
            content360ScheduleCanceled: true,
          }) as never,
          updatedAt: new Date(),
        })
        .where(eq(campaignPosts.id, post.id));
    }
    canceled += 1;
  }

  await refreshBatchAggregateStats(db, input.batchId);
  return { ok: true, canceled, batchId: input.batchId };
}
