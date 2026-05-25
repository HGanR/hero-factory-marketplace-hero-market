/**
 * Bentley scheduled publish worker branch for `publishRoute === "content360"`.
 * Same cron as native OAuth — updates `provider_publish_jobs`, `scheduled_publish_meta`, and `campaign_posts`.
 */

import crypto from "crypto";
import { and, eq, inArray } from "drizzle-orm";
import {
  campaignAuditEvents,
  campaignPosts,
  campaigns,
  campaignAssets,
  clientProviderConnections,
  providerPublishJobs,
} from "@/lib/db/schema";
import { persistPublishOutcomeDeploymentFeedback } from "@/lib/revenue-os/deployment-feedback-db";
import {
  canScheduledPostPublishUnderApprovalMode,
  readScheduledPublishRequireApprovalEnv,
} from "@/lib/revenue-os/publish-approval-gate";
import { CampaignPostPublishError } from "@/lib/social/campaign-post-publish";
import {
  buildRetryMetaAfterFailure,
  normalizeScheduledPublishFailure,
} from "@/lib/social/scheduled-publish-executor";
import { mergeRawScheduledPublishMeta, parseScheduledPublishMeta, isContent360PlatformScheduleTrustedMeta } from "@/lib/social/scheduled-publish-meta";
import type { Content360Service } from "@/lib/social/providers/content360/content360-service";
import { CONTENT360_PROVIDER_ID } from "@/lib/social/providers/content360/content360-types";
import type { Content360ExecuteOutcome } from "@/lib/social/providers/content360/content360-execute-types";
import { isContent360PlatformConfiguredFromEnv } from "@/lib/content360/content360-platform-env-read";

function getAffectedRows(res: unknown): number {
  if (
    res &&
    typeof res === "object" &&
    "affectedRows" in res &&
    typeof (res as { affectedRows?: number }).affectedRows === "number"
  ) {
    return (res as { affectedRows: number }).affectedRows;
  }
  if (Array.isArray(res) && res[0] && typeof res[0] === "object" && "affectedRows" in res[0]) {
    return (res[0] as { affectedRows: number }).affectedRows;
  }
  return 0;
}

function utmAsStringRecord(u: unknown): Record<string, string> | null {
  if (!u || typeof u !== "object") return null;
  const o: Record<string, string> = {};
  for (const [k, v] of Object.entries(u as Record<string, unknown>)) {
    if (v === null || v === undefined) continue;
    o[k] = String(v);
  }
  return o;
}

function mergeJobResponseJson(prev: unknown, patch: Record<string, unknown>): Record<string, unknown> {
  const base =
    prev && typeof prev === "object" && !Array.isArray(prev) ? { ...(prev as Record<string, unknown>) } : {};
  return { ...base, ...patch };
}

async function insertAudit(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  args: {
    userId: string;
    postId: string;
    platform: string | null;
    action: string;
    details: Record<string, unknown>;
  }
): Promise<void> {
  await db.insert(campaignAuditEvents).values({
    id: crypto.randomUUID(),
    userId: args.userId,
    postId: args.postId,
    action: args.action,
    platform: args.platform,
    details: args.details,
  });
}

export type Content360PublishWorkerResult =
  | "published"
  | "retried"
  | "failed"
  | "skipped"
  | "skipped_awaiting_approval"
  | "awaiting_remote";

type PublishContent360PostFn = (
  input: import("@/lib/content360/publish-content360-post").PublishContent360PostInput
) => Promise<import("@/lib/content360/publish-content360-post").PublishContent360PostResult>;

/**
 * Scheduled publish via centralized platform Content360 API (no `provider_publish_jobs` row).
 */
async function processContent360PlatformKeyScheduledDuePost(params: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any;
  post: typeof campaignPosts.$inferSelect;
  freshPost: typeof campaignPosts.$inferSelect;
  userId: string;
  now: Date;
  meta: ReturnType<typeof parseScheduledPublishMeta>;
  platformForAudit: string;
  publishContent360Post: PublishContent360PostFn;
}): Promise<Content360PublishWorkerResult> {
  const { db, post, freshPost, userId, now, meta, platformForAudit, publishContent360Post: publishFn } = params;

  const claimRes = await db
    .update(campaignPosts)
    .set({ status: "PUBLISHING", updatedAt: now })
    .where(and(eq(campaignPosts.id, post.id), inArray(campaignPosts.status, ["SCHEDULED", "RETRY_SCHEDULED"])));
  if (getAffectedRows(claimRes) < 1) {
    return "skipped";
  }

  const prevAttempt = meta.publishAttemptCount ?? 0;
  if (userId) {
    await insertAudit(db, {
      userId,
      postId: post.id,
      platform: platformForAudit,
      action: "content360_platform_publish_attempted",
      details: {
        attemptCount: prevAttempt + 1,
        publishRoute: "content360",
        content360PlatformScheduled: true,
        reason: "attempt_start",
      },
    });
  }

  let mediaUrl: string | null = null;
  if (freshPost.assetId) {
    const assetRows = await db
      .select()
      .from(campaignAssets)
      .where(eq(campaignAssets.id, freshPost.assetId))
      .limit(1);
    mediaUrl = assetRows[0]?.storageUrl ?? null;
  }
  const platformSlug = (meta.targetPlatform || freshPost.platform || "").trim().toLowerCase();
  const platforms = platformSlug ? [platformSlug] : ["instagram"];
  const scheduledIso = (() => {
    const raw = freshPost.scheduledAt;
    if (raw == null) return null;
    const d = raw instanceof Date ? raw : new Date(String(raw));
    return Number.isFinite(d.getTime()) ? d.toISOString() : null;
  })();

  try {
    const c360 = await publishFn({
      caption: freshPost.caption ?? "",
      mediaUrl,
      scheduledAt: scheduledIso,
      platforms,
      campaignId: post.campaignId,
      postId: post.id,
      metadata: {
        utmParams: freshPost.utmParams,
        linkUrl: freshPost.linkUrl,
        publishSource: "publish_worker_content360_platform",
        scheduledPublishSource: meta.scheduledPublishSource,
      },
    });
    if (!c360.ok) {
      throw new CampaignPostPublishError(
        c360.code || "CONTENT360_PUBLISH_FAILED",
        c360.message || "Content360 platform publish failed.",
      );
    }

    const publishedMeta = mergeRawScheduledPublishMeta(freshPost.scheduledPublishMeta, {
      providerStatus: "published",
      externalPostId: c360.platformPostId,
      content360PlatformPublish: true,
      content360ProviderResponse: c360.providerMetadata,
    });
    await db
      .update(campaignPosts)
      .set({
        status: "POSTED",
        platformPostId: c360.platformPostId,
        postedAt: now,
        errorMessage: null,
        scheduledPublishMeta: publishedMeta as never,
        updatedAt: now,
      })
      .where(eq(campaignPosts.id, post.id));

    if (userId) {
      await insertAudit(db, {
        userId,
        postId: post.id,
        platform: platformForAudit,
        action: "content360_platform_publish_succeeded",
        details: { platformPostId: c360.platformPostId, publishRoute: "content360" },
      });
      await persistPublishOutcomeDeploymentFeedback(db, {
        userId,
        campaignId: post.campaignId,
        campaignPostId: post.id,
        platform: String(platformForAudit),
        outcome: "published",
        source: "publish_worker",
        publishedAt: now,
        platformPostId: c360.platformPostId,
      });
    }
    return "published";
  } catch (err) {
    const norm =
      err instanceof CampaignPostPublishError
        ? normalizeScheduledPublishFailure(err, err.code)
        : normalizeScheduledPublishFailure(err);
    const currentMeta = (await db.select().from(campaignPosts).where(eq(campaignPosts.id, post.id)).limit(1))[0]
      ?.scheduledPublishMeta;
    const nextState = buildRetryMetaAfterFailure({ now, prevMeta: currentMeta, failure: norm });
    await db
      .update(campaignPosts)
      .set({
        status: nextState.status,
        errorMessage: norm.message,
        scheduledPublishMeta: mergeRawScheduledPublishMeta(currentMeta, {
          ...nextState.meta,
          providerStatus: "platform_publish_failed",
        }) as never,
        updatedAt: now,
      })
      .where(eq(campaignPosts.id, post.id));
    if (userId) {
      await insertAudit(db, {
        userId,
        postId: post.id,
        platform: platformForAudit,
        action:
          nextState.status === "RETRY_SCHEDULED"
            ? "content360_platform_publish_retry_scheduled"
            : "content360_platform_publish_failed",
        details: {
          code: norm.code,
          nextPublishAttemptAt: nextState.meta.nextPublishAttemptAt ?? null,
          retryable: norm.retryable && nextState.status === "RETRY_SCHEDULED",
        },
      });
      await persistPublishOutcomeDeploymentFeedback(db, {
        userId,
        campaignId: post.campaignId,
        campaignPostId: post.id,
        platform: String(platformForAudit),
        outcome: nextState.status === "RETRY_SCHEDULED" ? "retry_scheduled" : "failed",
        source: "publish_worker",
        errorCode: norm.code,
        errorMessage: norm.message,
      });
    }
    return nextState.status === "RETRY_SCHEDULED" ? "retried" : "failed";
  }
}

export async function processContent360DuePost(args: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any;
  post: typeof campaignPosts.$inferSelect;
  campaignAutopilotPublish: boolean;
  now: Date;
  requireApproval?: boolean;
  service?: Content360Service;
  /** Injected in tests; production uses real platform publish. */
  publishContent360PostFn?: PublishContent360PostFn;
}): Promise<Content360PublishWorkerResult> {
  const { db, post, now } = args;
  const requireApproval = args.requireApproval ?? readScheduledPublishRequireApprovalEnv();

  const utm = utmAsStringRecord(post.utmParams);
  const approvalGate = canScheduledPostPublishUnderApprovalMode({
    requireApproval,
    utmParams: utm,
    campaignAutopilotPublish: Boolean(args.campaignAutopilotPublish),
  });
  if (!approvalGate.ok) {
    return "skipped_awaiting_approval";
  }

  const campRows = await db.select().from(campaigns).where(eq(campaigns.id, post.campaignId)).limit(1);
  const campaign = campRows[0];
  const userId = campaign?.userId != null ? String(campaign.userId) : "";

  const freshRows = await db.select().from(campaignPosts).where(eq(campaignPosts.id, post.id)).limit(1);
  const freshPost = freshRows[0] ?? post;
  if (String(freshPost.status ?? "").toUpperCase() === "POSTED") {
    return "skipped";
  }

  const meta = parseScheduledPublishMeta(freshPost.scheduledPublishMeta);
  if (meta.publishRoute !== "content360") {
    return "skipped";
  }
  if (meta.content360ScheduleCanceled) {
    return "skipped";
  }

  const platformForAudit = meta.targetPlatform?.trim() || freshPost.platform;

  async function failPreClaim(
    message: string,
    patch: Record<string, unknown>,
    auditReason: string,
    code: string
  ): Promise<Content360PublishWorkerResult> {
    await db
      .update(campaignPosts)
      .set({
        status: "FAILED",
        errorMessage: message,
        scheduledPublishMeta: mergeRawScheduledPublishMeta(freshPost.scheduledPublishMeta, patch) as never,
        updatedAt: now,
      })
      .where(eq(campaignPosts.id, post.id));
    if (userId) {
      await insertAudit(db, {
        userId,
        postId: post.id,
        platform: platformForAudit,
        action: "content360_publish_failed",
        details: { reason: auditReason, retryable: false, code },
      });
      await persistPublishOutcomeDeploymentFeedback(db, {
        userId,
        campaignId: post.campaignId,
        campaignPostId: post.id,
        platform: String(platformForAudit),
        outcome: "failed",
        source: "publish_worker",
        errorCode: code,
        errorMessage: message,
      });
    }
    return "failed";
  }

  const jobId = meta.providerPublishJobId?.trim();
  const usePlatformKeySchedule =
    meta.publishRoute === "content360" &&
    Boolean(meta.content360PlatformScheduled) &&
    !jobId &&
    isContent360PlatformScheduleTrustedMeta(meta);

  if (usePlatformKeySchedule) {
    if (!isContent360PlatformConfiguredFromEnv()) {
      return await failPreClaim(
        "Platform Content360 API is not configured (set CONTENT360_BASE_URL and CONTENT360_API_KEY).",
        { providerStatus: "platform_not_configured" },
        "platform_not_configured",
        "CONTENT360_PLATFORM_NOT_CONFIGURED",
      );
    }
    const publishFn =
      args.publishContent360PostFn ??
      (await import("@/lib/content360/publish-content360-post")).publishContent360Post;
    return processContent360PlatformKeyScheduledDuePost({
      db,
      post,
      freshPost,
      userId,
      now,
      meta,
      platformForAudit: String(platformForAudit),
      publishContent360Post: publishFn,
    });
  }

  if (!jobId) {
    return await failPreClaim(
      "Missing providerPublishJobId in publish meta.",
      { providerStatus: "worker_missing_job_id" },
      "missing_provider_publish_job_id",
      "CONTENT360_MISSING_JOB",
    );
  }

  const jobRows = await db.select().from(providerPublishJobs).where(eq(providerPublishJobs.id, jobId)).limit(1);
  const jobPre = jobRows[0];
  if (!jobPre) {
    return await failPreClaim(
      "Provider publish job row not found.",
      { providerStatus: "worker_job_row_missing" },
      "job_not_found",
      "CONTENT360_JOB_NOT_FOUND",
    );
  }

  if (jobPre.provider !== CONTENT360_PROVIDER_ID) {
    return await failPreClaim(
      "Provider job is not a Content360 row — refusing to execute.",
      { providerStatus: "worker_provider_mismatch" },
      "provider_mismatch",
      "CONTENT360_PROVIDER_MISMATCH",
    );
  }

  if (!campaign || jobPre.clientId !== campaign.clientId) {
    return await failPreClaim(
      "Client scope mismatch for Content360 job.",
      { providerStatus: "worker_client_mismatch" },
      "client_mismatch",
      "CONTENT360_CLIENT_MISMATCH",
    );
  }

  if (jobPre.campaignId !== post.campaignId) {
    return await failPreClaim(
      "Campaign mismatch for Content360 job.",
      { providerStatus: "worker_campaign_mismatch" },
      "campaign_mismatch",
      "CONTENT360_CAMPAIGN_MISMATCH",
    );
  }

  if (jobPre.status === "published") {
    const platformPostId = jobPre.externalPostId?.trim() || meta.externalPostId?.trim();
    if (!platformPostId) {
      return await failPreClaim(
        "Job is marked published but no external post id is available.",
        { providerStatus: "worker_published_missing_id" },
        "published_missing_platform_id",
        "CONTENT360_PUBLISHED_WITHOUT_ID",
      );
    }
    const publishedMeta = mergeRawScheduledPublishMeta(freshPost.scheduledPublishMeta, {
      providerStatus: "published",
      externalPostId: platformPostId,
    });
    await db
      .update(campaignPosts)
      .set({
        status: "POSTED",
        platformPostId,
        postedAt: now,
        errorMessage: null,
        scheduledPublishMeta: publishedMeta as never,
        updatedAt: now,
      })
      .where(eq(campaignPosts.id, post.id));
    if (userId) {
      await insertAudit(db, {
        userId,
        postId: post.id,
        platform: platformForAudit,
        action: "content360_publish_succeeded",
        details: { jobId, platformPostId, reason: "idempotent_reconcile" },
      });
      await persistPublishOutcomeDeploymentFeedback(db, {
        userId,
        campaignId: post.campaignId,
        campaignPostId: post.id,
        platform: String(platformForAudit),
        outcome: "published",
        source: "publish_worker",
        publishedAt: now,
        platformPostId,
      });
    }
    return "published";
  }

  if (jobPre.status === "canceled" || jobPre.status === "disconnected_provider") {
    const msg =
      jobPre.status === "disconnected_provider"
        ? "Content360 connection was disconnected; this schedule will not run."
        : "Content360 schedule was canceled.";
    return await failPreClaim(
      msg,
      {
        providerStatus: jobPre.status === "disconnected_provider" ? "disconnected_provider" : "canceled",
      },
      jobPre.status,
      jobPre.status === "disconnected_provider" ? "CONTENT360_DISCONNECTED" : "CONTENT360_CANCELED",
    );
  }

  const claimRes = await db
    .update(campaignPosts)
    .set({ status: "PUBLISHING", updatedAt: now })
    .where(
      and(eq(campaignPosts.id, post.id), inArray(campaignPosts.status, ["SCHEDULED", "RETRY_SCHEDULED"]))
    );
  if (getAffectedRows(claimRes) < 1) {
    return "skipped";
  }

  const jobReload = await db.select().from(providerPublishJobs).where(eq(providerPublishJobs.id, jobId)).limit(1);
  const job = jobReload[0] ?? jobPre;

  async function revertPublishing(
    nextStatus: "SCHEDULED" | "FAILED",
    patch: Record<string, unknown>,
    err: string | null
  ): Promise<void> {
    await db
      .update(campaignPosts)
      .set({
        status: nextStatus,
        errorMessage: err,
        scheduledPublishMeta: mergeRawScheduledPublishMeta(freshPost.scheduledPublishMeta, patch as never),
        updatedAt: now,
      })
      .where(eq(campaignPosts.id, post.id));
  }

  const connRows = await db
    .select()
    .from(clientProviderConnections)
    .where(eq(clientProviderConnections.id, job.connectionId))
    .limit(1);
  const connection = connRows[0];
  if (!connection) {
    await revertPublishing("FAILED", { providerStatus: "connection_missing" }, "Content360 connection not found for job.");
    await db
      .update(providerPublishJobs)
      .set({
        status: "failed",
        errorMessage: "Connection row missing for provider job.",
        attempts: job.attempts + 1,
        lastAttemptAt: now,
        updatedAt: now,
      })
      .where(eq(providerPublishJobs.id, job.id));
    if (userId) {
      await insertAudit(db, {
        userId,
        postId: post.id,
        platform: platformForAudit,
        action: "content360_publish_failed",
        details: { jobId, reason: "connection_not_found", retryable: false },
      });
      await persistPublishOutcomeDeploymentFeedback(db, {
        userId,
        campaignId: post.campaignId,
        campaignPostId: post.id,
        platform: String(platformForAudit),
        outcome: "failed",
        source: "publish_worker",
        errorCode: "CONTENT360_CONNECTION_NOT_FOUND",
        errorMessage: "Content360 connection not found.",
      });
    }
    return "failed";
  }

  if (campaign && connection.clientId !== campaign.clientId) {
    await revertPublishing("FAILED", { providerStatus: "connection_client_mismatch" }, "Content360 connection does not belong to this campaign client.");
    await db
      .update(providerPublishJobs)
      .set({
        status: "failed",
        errorMessage: "Connection client mismatch for provider job.",
        attempts: job.attempts + 1,
        lastAttemptAt: now,
        updatedAt: now,
      })
      .where(eq(providerPublishJobs.id, job.id));
    if (userId) {
      await insertAudit(db, {
        userId,
        postId: post.id,
        platform: platformForAudit,
        action: "content360_publish_failed",
        details: { jobId, reason: "connection_client_mismatch", retryable: false },
      });
    }
    return "failed";
  }

  const prevAttempt = meta.publishAttemptCount ?? 0;
  if (userId) {
    await insertAudit(db, {
      userId,
      postId: post.id,
      platform: platformForAudit,
      action: "content360_publish_attempted",
      details: {
        attemptCount: prevAttempt + 1,
        jobId,
        publishRoute: "content360",
        reason: "attempt_start",
      },
    });
  }

  let outcome: Content360ExecuteOutcome;
  try {
    const svc =
      args.service ??
      new (await import("@/lib/social/providers/content360/content360-service")).Content360Service();
    outcome = await svc.executeScheduledPublish({ connection, job });
  } catch (err) {
    const norm =
      err instanceof CampaignPostPublishError
        ? normalizeScheduledPublishFailure(err, err.code)
        : normalizeScheduledPublishFailure(err);
    const currentMeta = (await db.select().from(campaignPosts).where(eq(campaignPosts.id, post.id)).limit(1))[0]
      ?.scheduledPublishMeta;
    const nextState = buildRetryMetaAfterFailure({ now, prevMeta: currentMeta, failure: norm });
    await db
      .update(campaignPosts)
      .set({
        status: nextState.status,
        errorMessage: norm.message,
        scheduledPublishMeta: mergeRawScheduledPublishMeta(currentMeta, nextState.meta) as never,
        updatedAt: now,
      })
      .where(eq(campaignPosts.id, post.id));
    await db
      .update(providerPublishJobs)
      .set({
        status: nextState.status === "RETRY_SCHEDULED" ? "queued" : "failed",
        errorMessage: norm.message,
        attempts: job.attempts + 1,
        lastAttemptAt: now,
        providerResponseJson: mergeJobResponseJson(job.providerResponseJson, {
          lastWorkerError: norm.message,
          lastWorkerErrorCode: norm.code,
          lastWorkerAt: now.toISOString(),
        }),
        updatedAt: now,
      })
      .where(eq(providerPublishJobs.id, job.id));
    if (userId) {
      await insertAudit(db, {
        userId,
        postId: post.id,
        platform: platformForAudit,
        action:
          nextState.status === "RETRY_SCHEDULED"
            ? "content360_publish_retry_scheduled"
            : "content360_publish_failed",
        details: {
          jobId,
          code: norm.code,
          nextPublishAttemptAt: nextState.meta.nextPublishAttemptAt ?? null,
          retryable: norm.retryable && nextState.status === "RETRY_SCHEDULED",
        },
      });
      await persistPublishOutcomeDeploymentFeedback(db, {
        userId,
        campaignId: post.campaignId,
        campaignPostId: post.id,
        platform: String(platformForAudit),
        outcome: nextState.status === "RETRY_SCHEDULED" ? "retry_scheduled" : "failed",
        source: "publish_worker",
        errorCode: norm.code,
        errorMessage: norm.message,
      });
    }
    return nextState.status === "RETRY_SCHEDULED" ? "retried" : "failed";
  }

  if (outcome.kind === "awaiting_remote") {
    const mergedMeta = mergeRawScheduledPublishMeta(freshPost.scheduledPublishMeta, {
      providerStatus: outcome.providerStatus,
      lastContent360WorkerPollAt: now.toISOString(),
    });
    await db
      .update(campaignPosts)
      .set({
        status: "SCHEDULED",
        scheduledPublishMeta: mergedMeta as never,
        updatedAt: now,
      })
      .where(eq(campaignPosts.id, post.id));
    await db
      .update(providerPublishJobs)
      .set({
        status: "queued",
        attempts: job.attempts + 1,
        lastAttemptAt: now,
        providerResponseJson: mergeJobResponseJson(job.providerResponseJson, {
          lastWorkerPollAt: now.toISOString(),
          lastPollRaw: outcome.raw ?? {},
        }),
        updatedAt: now,
      })
      .where(eq(providerPublishJobs.id, job.id));
    if (userId) {
      await insertAudit(db, {
        userId,
        postId: post.id,
        platform: platformForAudit,
        action: "content360_publish_awaiting_remote",
        details: { jobId, providerStatus: outcome.providerStatus },
      });
    }
    return "awaiting_remote";
  }

  if (outcome.kind === "failed_retryable") {
    const err = new CampaignPostPublishError(outcome.code, outcome.message);
    const norm = normalizeScheduledPublishFailure(err, outcome.code);
    const currentMeta = (await db.select().from(campaignPosts).where(eq(campaignPosts.id, post.id)).limit(1))[0]
      ?.scheduledPublishMeta;
    const nextState = buildRetryMetaAfterFailure({ now, prevMeta: currentMeta, failure: norm });
    await db
      .update(campaignPosts)
      .set({
        status: nextState.status,
        errorMessage: norm.message,
        scheduledPublishMeta: mergeRawScheduledPublishMeta(currentMeta, {
          ...nextState.meta,
          providerStatus: "worker_retryable",
        }) as never,
        updatedAt: now,
      })
      .where(eq(campaignPosts.id, post.id));
    await db
      .update(providerPublishJobs)
      .set({
        status: nextState.status === "RETRY_SCHEDULED" ? "queued" : "failed",
        errorMessage: norm.message,
        attempts: job.attempts + 1,
        lastAttemptAt: now,
        providerResponseJson: mergeJobResponseJson(job.providerResponseJson, {
          lastWorkerError: norm.message,
          lastWorkerErrorCode: norm.code,
          lastWorkerRaw: outcome.raw ?? {},
          lastWorkerAt: now.toISOString(),
        }),
        updatedAt: now,
      })
      .where(eq(providerPublishJobs.id, job.id));
    if (userId) {
      await insertAudit(db, {
        userId,
        postId: post.id,
        platform: platformForAudit,
        action:
          nextState.status === "RETRY_SCHEDULED"
            ? "content360_publish_retry_scheduled"
            : "content360_publish_failed",
        details: { jobId, code: norm.code, nextPublishAttemptAt: nextState.meta.nextPublishAttemptAt ?? null },
      });
      await persistPublishOutcomeDeploymentFeedback(db, {
        userId,
        campaignId: post.campaignId,
        campaignPostId: post.id,
        platform: String(platformForAudit),
        outcome: nextState.status === "RETRY_SCHEDULED" ? "retry_scheduled" : "failed",
        source: "publish_worker",
        errorCode: norm.code,
        errorMessage: norm.message,
      });
    }
    return nextState.status === "RETRY_SCHEDULED" ? "retried" : "failed";
  }

  if (outcome.kind === "failed_terminal") {
    const err = new CampaignPostPublishError(outcome.code, outcome.message);
    const norm = normalizeScheduledPublishFailure(err, outcome.code);
    const currentMeta = (await db.select().from(campaignPosts).where(eq(campaignPosts.id, post.id)).limit(1))[0]
      ?.scheduledPublishMeta;
    const nextState = buildRetryMetaAfterFailure({ now, prevMeta: currentMeta, failure: norm });
    await db
      .update(campaignPosts)
      .set({
        status: nextState.status,
        errorMessage: norm.message,
        scheduledPublishMeta: mergeRawScheduledPublishMeta(currentMeta, {
          ...nextState.meta,
          providerStatus: "provider_failed",
        }) as never,
        updatedAt: now,
      })
      .where(eq(campaignPosts.id, post.id));
    await db
      .update(providerPublishJobs)
      .set({
        status: "failed",
        errorMessage: norm.message,
        attempts: job.attempts + 1,
        lastAttemptAt: now,
        providerResponseJson: mergeJobResponseJson(job.providerResponseJson, {
          lastWorkerError: norm.message,
          lastWorkerErrorCode: norm.code,
          lastWorkerRaw: outcome.raw ?? {},
          lastWorkerAt: now.toISOString(),
        }),
        updatedAt: now,
      })
      .where(eq(providerPublishJobs.id, job.id));
    if (userId) {
      await insertAudit(db, {
        userId,
        postId: post.id,
        platform: platformForAudit,
        action:
          nextState.status === "RETRY_SCHEDULED"
            ? "content360_publish_retry_scheduled"
            : "content360_publish_failed",
        details: { jobId, code: norm.code },
      });
      await persistPublishOutcomeDeploymentFeedback(db, {
        userId,
        campaignId: post.campaignId,
        campaignPostId: post.id,
        platform: String(platformForAudit),
        outcome: nextState.status === "RETRY_SCHEDULED" ? "retry_scheduled" : "failed",
        source: "publish_worker",
        errorCode: norm.code,
        errorMessage: norm.message,
      });
    }
    return nextState.status === "RETRY_SCHEDULED" ? "retried" : "failed";
  }

  const publishedMeta = mergeRawScheduledPublishMeta(freshPost.scheduledPublishMeta, {
    providerStatus: "published",
    externalPostId: outcome.platformPostId,
  });
  await db
    .update(campaignPosts)
    .set({
      status: "POSTED",
      platformPostId: outcome.platformPostId,
      postedAt: now,
      errorMessage: null,
      scheduledPublishMeta: publishedMeta as never,
      updatedAt: now,
    })
    .where(eq(campaignPosts.id, post.id));
  await db
    .update(providerPublishJobs)
    .set({
      status: "published",
      externalPostId: outcome.platformPostId,
      errorMessage: null,
      attempts: job.attempts + 1,
      lastAttemptAt: now,
      providerResponseJson: mergeJobResponseJson(job.providerResponseJson, {
        lastWorkerSuccessAt: now.toISOString(),
        lastWorkerRaw: outcome.raw ?? {},
      }),
      updatedAt: now,
    })
    .where(eq(providerPublishJobs.id, job.id));
  if (userId) {
    await insertAudit(db, {
      userId,
      postId: post.id,
      platform: platformForAudit,
      action: "content360_publish_succeeded",
      details: { jobId, platformPostId: outcome.platformPostId },
    });
    await persistPublishOutcomeDeploymentFeedback(db, {
      userId,
      campaignId: post.campaignId,
      campaignPostId: post.id,
      platform: String(platformForAudit),
      outcome: "published",
      source: "publish_worker",
      publishedAt: now,
      platformPostId: outcome.platformPostId,
    });
  }
  return "published";
}
