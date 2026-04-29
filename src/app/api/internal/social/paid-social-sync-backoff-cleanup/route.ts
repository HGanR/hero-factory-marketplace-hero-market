import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import {
  buildNormalizedInternalJobResult,
  deriveInternalJobRunStatus,
  logInternalJobRunStructured,
  persistInternalJobRun,
  truncateInternalJobMessage,
} from "@/lib/revenue-os/internal-batch-job-run";
import { governanceInternalErrorResponse, governanceUnauthorizedResponse } from "@/lib/revenue-os/campaign-governance-http-response";
import { isAuthorizedInternalCronRequest } from "@/lib/social/internal-worker-cron-auth";
import {
  PAID_SOCIAL_BACKOFF_CLEANUP_MAX_DELETE_HARD,
  runPaidSocialSyncBackoffCleanup,
} from "@/lib/social/run-paid-social-sync-backoff-cleanup";

const JOB_TYPE = "paid_social_sync_backoff_cleanup";

const BodySchema = z
  .object({
    limit: z.number().int().min(1).max(PAID_SOCIAL_BACKOFF_CLEANUP_MAX_DELETE_HARD).optional(),
  })
  .strict();

/**
 * POST /api/internal/social/paid-social-sync-backoff-cleanup
 *
 * Deletes rows in `paid_social_sync_backoff_state` whose `backoff_until` is in the past (Part 53).
 * Auth: internal cron headers (`CRON_SECRET` / `SCHEDULED_PUBLISH_WORKER_SECRET`).
 */
export async function POST(req: NextRequest) {
  const startedAt = new Date();
  try {
    if (!isAuthorizedInternalCronRequest(req)) {
      return governanceUnauthorizedResponse();
    }

    let limit: number | undefined;
    try {
      const raw = await req.json().catch(() => ({}));
      const p = BodySchema.safeParse(raw);
      if (p.success && p.data.limit != null) limit = p.data.limit;
    } catch {
      /* empty body */
    }

    const db = await getDb();
    const run = await runPaidSocialSyncBackoffCleanup(db, { limit });
    const finishedAt = new Date();

    const summaryPayload: Record<string, unknown> = {
      scannedCount: run.scannedCount,
      deletedCount: run.deletedCount,
      limitApplied: run.limitApplied,
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
      errorCount: 0,
    });

    return NextResponse.json(normalized);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[internal/social/paid-social-sync-backoff-cleanup]", e);
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
