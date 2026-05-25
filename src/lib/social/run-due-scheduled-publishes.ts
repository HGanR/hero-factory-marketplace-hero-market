/**
 * Worker: claim due SCHEDULED / RETRY_SCHEDULED posts and publish via social adapters.
 */

import { eq, and, inArray, asc } from "drizzle-orm";
import crypto from "crypto";
import { campaignPosts, campaignAuditEvents, campaigns } from "@/lib/db/schema";
import type { CampaignPostPublishContext } from "@/lib/social/campaign-post-publish";
import {
  loadCampaignPostPublishContext,
  executeCampaignPostAdapterPublish,
  CampaignPostPublishError,
} from "@/lib/social/campaign-post-publish";
import { publishLinkedinScheduledPost } from "@/lib/social/publish-linkedin-scheduled-post";
import type { PublishResult } from "@/lib/social/types";
import {
  isScheduledPostDue,
  normalizeScheduledPublishFailure,
  buildRetryMetaAfterFailure,
} from "@/lib/social/scheduled-publish-executor";
import { parseScheduledPublishMeta } from "@/lib/social/scheduled-publish-meta";
import { persistPublishOutcomeDeploymentFeedback } from "@/lib/revenue-os/deployment-feedback-db";
import {
  canScheduledPostPublishUnderApprovalMode,
  readScheduledPublishRequireApprovalEnv,
} from "@/lib/revenue-os/publish-approval-gate";

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

export type RunDueScheduledPublishesSummary = {
  scanned: number;
  attempted: number;
  published: number;
  retried: number;
  failed: number;
  skipped: number;
  /** Skipped because approval gate is on and post not approved. */
  skippedAwaitingApproval: number;
  /** `publishRoute === "content360"` — same cron tick, separate counters. */
  content360Scanned?: number;
  content360Attempted?: number;
  content360Published?: number;
  content360Retried?: number;
  content360Failed?: number;
  content360Skipped?: number;
  content360SkippedAwaitingApproval?: number;
  /** Post left SCHEDULED while provider has not confirmed publish yet. */
  content360AwaitingRemote?: number;
};

async function insertAudit(
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

/**
 * Process due scheduled posts (cron / internal API). Idempotent: concurrent workers race on claim.
 */
export type ScheduledPublishPublishDeps = {
  loadContext: (db: unknown, postId: string) => Promise<CampaignPostPublishContext | null>;
  executePublish: (ctx: CampaignPostPublishContext) => Promise<PublishResult>;
  /** Injected in tests; production default is lazy-imported. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  processContent360DuePost?: any;
};

/** Lazy-loaded so `node:test` + tsx do not import `server-only` graph unless a Content360 row runs. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let cachedProcessContent360DuePost: any = null;
async function resolveProcessContent360DuePost(injected?: any) {
  if (injected) return injected;
  if (!cachedProcessContent360DuePost) {
    const m = await import("@/lib/social/content360-publish-worker");
    cachedProcessContent360DuePost = m.processContent360DuePost;
  }
  return cachedProcessContent360DuePost;
}
export async function defaultExecuteScheduledPublish(ctx: CampaignPostPublishContext): Promise<PublishResult> {
  if (ctx.platformKey === "linkedin") {
    const r = await publishLinkedinScheduledPost(ctx);
    if (!r.ok) {
      throw new CampaignPostPublishError("PROVIDER_PUBLISH_FAILED", r.normalizedError);
    }
    return { platformPostId: r.externalPostId };
  }
  if (parseScheduledPublishMeta(ctx.post.scheduledPublishMeta).publishRoute === "content360") {
    throw new CampaignPostPublishError(
      "CONTENT360_WRONG_EXECUTOR",
      "This post is routed to Content360 and must not be processed by the native OAuth publisher.",
    );
  }
  return executeCampaignPostAdapterPublish(ctx);
}

export async function runDueScheduledPublishes(args?: {
  now?: Date;
  limit?: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db?: any;
  deps?: Partial<ScheduledPublishPublishDeps>;
}): Promise<RunDueScheduledPublishesSummary> {
  const now = args?.now ?? new Date();
  const limit = Math.min(Math.max(args?.limit ?? 25, 1), 100);
  const { getDb } = await import("@/lib/db");
  const db = args?.db ?? (await getDb());
  const loadContext = args?.deps?.loadContext ?? loadCampaignPostPublishContext;
  const executePublish = args?.deps?.executePublish ?? defaultExecuteScheduledPublish;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let runContent360Branch: any = null;

  const summary: RunDueScheduledPublishesSummary = {
    scanned: 0,
    attempted: 0,
    published: 0,
    retried: 0,
    failed: 0,
    skipped: 0,
    skippedAwaitingApproval: 0,
    content360Scanned: 0,
    content360Attempted: 0,
    content360Published: 0,
    content360Retried: 0,
    content360Failed: 0,
    content360Skipped: 0,
    content360SkippedAwaitingApproval: 0,
    content360AwaitingRemote: 0,
  };

  const requireApproval = readScheduledPublishRequireApprovalEnv();

  function utmAsStringRecord(u: unknown): Record<string, string> | null {
    if (!u || typeof u !== "object") return null;
    const o: Record<string, string> = {};
    for (const [k, v] of Object.entries(u as Record<string, unknown>)) {
      if (v === null || v === undefined) continue;
      o[k] = String(v);
    }
    return o;
  }

  const candidates = await db
    .select({
      post: campaignPosts,
      campaignAutopilotPublish: campaigns.bentleyAutopilotPublish,
    })
    .from(campaignPosts)
    .innerJoin(campaigns, eq(campaignPosts.campaignId, campaigns.id))
    .where(inArray(campaignPosts.status, ["SCHEDULED", "RETRY_SCHEDULED"]))
    .orderBy(asc(campaignPosts.scheduledAt))
    .limit(limit * 4);

  const dueAll = candidates.filter((row: (typeof candidates)[number]) =>
    isScheduledPostDue(
      {
        id: row.post.id,
        status: row.post.status,
        scheduledAt: row.post.scheduledAt,
        scheduledPublishMeta: row.post.scheduledPublishMeta,
      },
      now
    )
  );

  const dueContent360 = dueAll.filter(
    (row: (typeof candidates)[number]) =>
      parseScheduledPublishMeta(row.post.scheduledPublishMeta).publishRoute === "content360"
  );

  summary.scanned = dueAll.length;
  summary.content360Scanned = dueContent360.length;

  function scheduledSortMs(p: (typeof campaignPosts.$inferSelect) & { scheduledPublishMeta?: unknown }): number {
    const st = String(p.status || "").toUpperCase();
    if (st === "RETRY_SCHEDULED") {
      const m = parseScheduledPublishMeta(p.scheduledPublishMeta);
      const t = m.nextPublishAttemptAt ? new Date(m.nextPublishAttemptAt).getTime() : NaN;
      return Number.isFinite(t) ? t : Number.MAX_SAFE_INTEGER;
    }
    const raw = p.scheduledAt;
    const t = raw instanceof Date ? raw.getTime() : raw ? new Date(String(raw)).getTime() : NaN;
    return Number.isFinite(t) ? t : Number.MAX_SAFE_INTEGER;
  }

  const combined = dueAll
    .map((row: (typeof dueAll)[number]) => ({
      row,
      isContent360: parseScheduledPublishMeta(row.post.scheduledPublishMeta).publishRoute === "content360",
      sortKey: scheduledSortMs(row.post),
    }))
    .sort((a, b) => a.sortKey - b.sortKey)
    .slice(0, limit);

  for (const item of combined) {
    if (item.isContent360) {
      if (!runContent360Branch) {
        runContent360Branch = await resolveProcessContent360DuePost(args?.deps?.processContent360DuePost);
      }
      const row = item.row;
      const c360 = await runContent360Branch({
        db,
        post: row.post,
        campaignAutopilotPublish: Boolean(row.campaignAutopilotPublish),
        now,
        requireApproval,
      });
      if (c360 === "skipped") summary.content360Skipped = (summary.content360Skipped ?? 0) + 1;
      else if (c360 === "skipped_awaiting_approval") {
        summary.content360SkippedAwaitingApproval = (summary.content360SkippedAwaitingApproval ?? 0) + 1;
      } else {
        summary.content360Attempted = (summary.content360Attempted ?? 0) + 1;
        if (c360 === "published") summary.content360Published = (summary.content360Published ?? 0) + 1;
        else if (c360 === "retried") summary.content360Retried = (summary.content360Retried ?? 0) + 1;
        else if (c360 === "failed") summary.content360Failed = (summary.content360Failed ?? 0) + 1;
        else if (c360 === "awaiting_remote") summary.content360AwaitingRemote = (summary.content360AwaitingRemote ?? 0) + 1;
      }
      continue;
    }

    const row = item.row;
    const post = row.post;
    const utm = utmAsStringRecord(post.utmParams);
    const approvalGate = canScheduledPostPublishUnderApprovalMode({
      requireApproval,
      utmParams: utm,
      campaignAutopilotPublish: Boolean(row.campaignAutopilotPublish),
    });
    if (!approvalGate.ok) {
      summary.skippedAwaitingApproval += 1;
      continue;
    }

    const claimRes = await db
      .update(campaignPosts)
      .set({ status: "PUBLISHING", updatedAt: now })
      .where(
        and(
          eq(campaignPosts.id, post.id),
          inArray(campaignPosts.status, ["SCHEDULED", "RETRY_SCHEDULED"])
        )
      );
    if (getAffectedRows(claimRes) < 1) {
      summary.skipped += 1;
      continue;
    }

    summary.attempted += 1;

    try {
      const ctx = await loadContext(db, post.id);
      if (!ctx) {
        throw new CampaignPostPublishError("POST_NOT_FOUND", "Post disappeared after claim.");
      }

      await insertAudit(db, {
        userId: ctx.campaign.userId,
        postId: post.id,
        platform: ctx.platformKey,
        action: "scheduled_publish_attempted",
        details: {
          attemptCount: (parseScheduledPublishMeta(post.scheduledPublishMeta).publishAttemptCount ?? 0) + 1,
          retryable: true,
          reason: "attempt_start",
        },
      });

      const result = await executePublish(ctx);

      await db
        .update(campaignPosts)
        .set({
          status: "POSTED",
          platformPostId: result.platformPostId,
          postedAt: now,
          errorMessage: null,
          scheduledPublishMeta: {},
          updatedAt: now,
        })
        .where(eq(campaignPosts.id, post.id));

      await insertAudit(db, {
        userId: ctx.campaign.userId,
        postId: post.id,
        platform: ctx.platformKey,
        action: "scheduled_publish_succeeded",
        details: {
          platformPostId: result.platformPostId,
          attemptCount: parseScheduledPublishMeta(post.scheduledPublishMeta).publishAttemptCount ?? 0,
          retryable: false,
          reason: "ok",
        },
      });

      await persistPublishOutcomeDeploymentFeedback(db, {
        userId: ctx.campaign.userId,
        campaignId: ctx.post.campaignId,
        campaignPostId: post.id,
        platform: ctx.platformKey,
        outcome: "published",
        source: "publish_worker",
        publishedAt: now,
        platformPostId: result.platformPostId,
      });

      summary.published += 1;
    } catch (err) {
      const norm =
        err instanceof CampaignPostPublishError
          ? normalizeScheduledPublishFailure(err, err.code)
          : normalizeScheduledPublishFailure(err);

      const ctxTry = await loadContext(db, post.id).catch(() => null);
      const userId = ctxTry?.campaign.userId ?? "";
      const platform = ctxTry?.platformKey ?? post.platform;

      const fresh = await db.select().from(campaignPosts).where(eq(campaignPosts.id, post.id)).limit(1);
      const currentMeta = fresh[0]?.scheduledPublishMeta;

      const nextState = buildRetryMetaAfterFailure({
        now,
        prevMeta: currentMeta,
        failure: norm,
      });

      await db
        .update(campaignPosts)
        .set({
          status: nextState.status,
          errorMessage: norm.message,
          scheduledPublishMeta: nextState.meta,
          updatedAt: now,
        })
        .where(eq(campaignPosts.id, post.id));

      if (userId) {
        await insertAudit(db, {
          userId,
          postId: post.id,
          platform,
          action:
            nextState.status === "RETRY_SCHEDULED"
              ? "scheduled_publish_retry_scheduled"
              : "scheduled_publish_failed",
          details: {
            attemptCount: nextState.meta.publishAttemptCount ?? 0,
            retryable: norm.retryable && nextState.status === "RETRY_SCHEDULED",
            normalizedReason: norm.message,
            code: norm.code,
            nextPublishAttemptAt: nextState.meta.nextPublishAttemptAt ?? null,
          },
        });

        await persistPublishOutcomeDeploymentFeedback(db, {
          userId,
          campaignId: post.campaignId,
          campaignPostId: post.id,
          platform: String(platform),
          outcome: nextState.status === "RETRY_SCHEDULED" ? "retry_scheduled" : "failed",
          source: "publish_worker",
          errorCode: norm.code,
          errorMessage: norm.message,
        });
      }

      if (nextState.status === "RETRY_SCHEDULED") summary.retried += 1;
      else summary.failed += 1;
    }
  }

  return summary;
}
