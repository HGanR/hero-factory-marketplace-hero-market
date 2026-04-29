/**
 * Worker: claim due SCHEDULED / RETRY_SCHEDULED posts and publish via social adapters.
 */

import { eq, and, inArray, asc } from "drizzle-orm";
import crypto from "crypto";
import { campaignPosts, campaignAuditEvents } from "@/lib/db/schema";
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
};

/** LinkedIn uses the REST scheduled-post path; other governed platforms use Graph adapters. */
export async function defaultExecuteScheduledPublish(ctx: CampaignPostPublishContext): Promise<PublishResult> {
  if (ctx.platformKey === "linkedin") {
    const r = await publishLinkedinScheduledPost(ctx);
    if (!r.ok) {
      throw new CampaignPostPublishError("PROVIDER_PUBLISH_FAILED", r.normalizedError);
    }
    return { platformPostId: r.externalPostId };
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

  const summary: RunDueScheduledPublishesSummary = {
    scanned: 0,
    attempted: 0,
    published: 0,
    retried: 0,
    failed: 0,
    skipped: 0,
    skippedAwaitingApproval: 0,
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
    .select()
    .from(campaignPosts)
    .where(inArray(campaignPosts.status, ["SCHEDULED", "RETRY_SCHEDULED"]))
    .orderBy(asc(campaignPosts.scheduledAt))
    .limit(limit * 4);

  const due = candidates.filter((row: (typeof candidates)[number]) =>
    isScheduledPostDue(
      {
        id: row.id,
        status: row.status,
        scheduledAt: row.scheduledAt,
        scheduledPublishMeta: row.scheduledPublishMeta,
      },
      now
    )
  );

  summary.scanned = due.length;

  for (const row of due.slice(0, limit)) {
    const utm = utmAsStringRecord(row.utmParams);
    const approvalGate = canScheduledPostPublishUnderApprovalMode({
      requireApproval,
      utmParams: utm,
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
          eq(campaignPosts.id, row.id),
          inArray(campaignPosts.status, ["SCHEDULED", "RETRY_SCHEDULED"])
        )
      );
    if (getAffectedRows(claimRes) < 1) {
      summary.skipped += 1;
      continue;
    }

    summary.attempted += 1;

    try {
      const ctx = await loadContext(db, row.id);
      if (!ctx) {
        throw new CampaignPostPublishError("POST_NOT_FOUND", "Post disappeared after claim.");
      }

      await insertAudit(db, {
        userId: ctx.campaign.userId,
        postId: row.id,
        platform: ctx.platformKey,
        action: "scheduled_publish_attempted",
        details: {
          attemptCount: (parseScheduledPublishMeta(row.scheduledPublishMeta).publishAttemptCount ?? 0) + 1,
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
        .where(eq(campaignPosts.id, row.id));

      await insertAudit(db, {
        userId: ctx.campaign.userId,
        postId: row.id,
        platform: ctx.platformKey,
        action: "scheduled_publish_succeeded",
        details: {
          platformPostId: result.platformPostId,
          attemptCount: parseScheduledPublishMeta(row.scheduledPublishMeta).publishAttemptCount ?? 0,
          retryable: false,
          reason: "ok",
        },
      });

      await persistPublishOutcomeDeploymentFeedback(db, {
        userId: ctx.campaign.userId,
        campaignId: ctx.post.campaignId,
        campaignPostId: row.id,
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

      const ctxTry = await loadContext(db, row.id).catch(() => null);
      const userId = ctxTry?.campaign.userId ?? "";
      const platform = ctxTry?.platformKey ?? row.platform;

      const fresh = await db.select().from(campaignPosts).where(eq(campaignPosts.id, row.id)).limit(1);
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
        .where(eq(campaignPosts.id, row.id));

      if (userId) {
        await insertAudit(db, {
          userId,
          postId: row.id,
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
          campaignId: row.campaignId,
          campaignPostId: row.id,
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
