import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { campaignAuditEvents } from "@/lib/db/schema";
import {
  buildNormalizedInternalJobResult,
  deriveInternalJobRunStatus,
  logInternalJobRunStructured,
  persistInternalJobRun,
  truncateInternalJobMessage,
} from "@/lib/revenue-os/internal-batch-job-run";
import { governanceInternalErrorResponse, governanceUnauthorizedResponse } from "@/lib/revenue-os/campaign-governance-http-response";
import { isAuthorizedInternalCronRequest } from "@/lib/social/internal-worker-cron-auth";
import { runScheduledPaidSocialMetaSync } from "@/lib/social/run-scheduled-paid-social-meta-sync";
import {
  SCHEDULED_PAID_META_SYNC_MAX_CAMPAIGNS_HARD,
  SCHEDULED_PAID_META_SYNC_MAX_ITEMS_HARD,
  SCHEDULED_PAID_META_SYNC_MAX_PER_ACCOUNT_HARD,
  SCHEDULED_PAID_META_SYNC_SCAN_POOL_HARD,
  SCHEDULED_PAID_META_SYNC_THROTTLE_PAUSE_AFTER_HARD,
  SCHEDULED_PAID_META_SYNC_THROTTLE_PAUSE_AFTER_MIN,
} from "@/lib/social/paid-social-scheduled-meta-sync-config";

const JOB_TYPE = "paid_social_meta_sync_scheduled";

const BodySchema = z
  .object({
    maxItems: z.number().int().min(1).max(SCHEDULED_PAID_META_SYNC_MAX_ITEMS_HARD).optional(),
    maxPerRun: z.number().int().min(1).max(SCHEDULED_PAID_META_SYNC_MAX_ITEMS_HARD).optional(),
    scanPoolLimit: z.number().int().min(10).max(SCHEDULED_PAID_META_SYNC_SCAN_POOL_HARD).optional(),
    maxPerAccount: z.number().int().min(1).max(SCHEDULED_PAID_META_SYNC_MAX_PER_ACCOUNT_HARD).optional(),
    maxCampaigns: z.number().int().min(1).max(SCHEDULED_PAID_META_SYNC_MAX_CAMPAIGNS_HARD).optional(),
    throttlePauseAfter: z
      .number()
      .int()
      .min(SCHEDULED_PAID_META_SYNC_THROTTLE_PAUSE_AFTER_MIN)
      .max(SCHEDULED_PAID_META_SYNC_THROTTLE_PAUSE_AFTER_HARD)
      .optional(),
  })
  .strict();

/**
 * POST /api/internal/social/paid-social-meta-sync-scheduled
 *
 * Cron: bounded Meta readback for launched paid campaigns (Parts 50–52).
 * Auth: same internal cron headers as other workers (`CRON_SECRET` / `SCHEDULED_PUBLISH_WORKER_SECRET`).
 */
export async function POST(req: NextRequest) {
  const startedAt = new Date();
  try {
    if (!isAuthorizedInternalCronRequest(req)) {
      return governanceUnauthorizedResponse();
    }

    let opts: z.infer<typeof BodySchema> = {};
    try {
      const raw = await req.json().catch(() => ({}));
      const p = BodySchema.safeParse(raw);
      if (p.success) opts = p.data;
    } catch {
      /* empty */
    }

    const db = await getDb();
    const run = await runScheduledPaidSocialMetaSync(db, opts);
    const finishedAt = new Date();

    if (!run.skipped) {
      await db.insert(campaignAuditEvents).values({
        id: crypto.randomUUID(),
        userId: "0",
        postId: null,
        action: "paid_social_meta_sync_scheduled_ran",
        platform: "paid_social",
        details: {
          poolScanned: run.poolScanned,
          attempted: run.attempted,
          succeeded: run.succeeded,
          successCount: run.successCount,
          failed: run.failed,
          throttledCount: run.throttledCount,
          authErrorCount: run.authErrorCount,
          deferredDueToBackoff: run.deferredDueToBackoff,
          deferredDueToRunBackoff: run.deferredDueToRunBackoff,
          deferredDueToPersistedBackoff: run.deferredDueToPersistedBackoff,
          accountsDeferredDueToPersistedBackoff: run.accountsDeferredDueToPersistedBackoff,
          deferredDueToPerAccount: run.deferredDueToPerAccount,
          deferredDueToMaxCampaigns: run.deferredDueToMaxCampaigns,
          configApplied: run.configApplied,
        },
        createdAt: new Date(),
      });
    }

    const summaryPayload: Record<string, unknown> = {
      skipped: run.skipped,
      reason: run.reason ?? null,
      poolScanned: run.poolScanned,
      attempted: run.attempted,
      succeeded: run.succeeded,
      successCount: run.successCount,
      failed: run.failed,
      throttledCount: run.throttledCount,
      authErrorCount: run.authErrorCount,
      errors: run.errors.length,
      deferredDueToBackoff: run.deferredDueToBackoff,
      deferredDueToRunBackoff: run.deferredDueToRunBackoff,
      deferredDueToPersistedBackoff: run.deferredDueToPersistedBackoff,
      accountsDeferredDueToPersistedBackoff: run.accountsDeferredDueToPersistedBackoff,
      deferredDueToPerAccount: run.deferredDueToPerAccount,
      deferredDueToMaxCampaigns: run.deferredDueToMaxCampaigns,
      configApplied: run.configApplied,
    };

    const normalized = buildNormalizedInternalJobResult({
      jobType: JOB_TYPE,
      startedAt,
      finishedAt,
      summary: summaryPayload,
      boundedErrors: [],
    });
    logInternalJobRunStructured(normalized);

    await persistInternalJobRun(db, {
      jobType: JOB_TYPE,
      startedAt,
      finishedAt,
      status: deriveInternalJobRunStatus({ boundedErrors: [], summary: summaryPayload }),
      summary: summaryPayload,
      errorCount: run.failed,
    });

    return NextResponse.json(normalized);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[internal/social/paid-social-meta-sync-scheduled]", e);
    try {
      const db = await getDb();
      const finishedAt = new Date();
      await persistInternalJobRun(db, {
        jobType: JOB_TYPE,
        startedAt,
        finishedAt,
        status: "failed",
        summary: { fatal: true, message: truncateInternalJobMessage(msg) },
        errorCount: 1,
      });
    } catch {
      /* ignore */
    }
    return governanceInternalErrorResponse();
  }
}
