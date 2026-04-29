import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import {
  buildNormalizedInternalJobResult,
  deriveInternalJobRunStatus,
  logInternalJobRunStructured,
  persistInternalJobRun,
  pushBoundedInternalJobError,
  truncateInternalJobMessage,
  type InternalJobBoundedError,
} from "@/lib/revenue-os/internal-batch-job-run";
import { governanceInternalErrorResponse, governanceUnauthorizedResponse } from "@/lib/revenue-os/campaign-governance-http-response";
import { isAuthorizedInternalCronRequest } from "@/lib/social/internal-worker-cron-auth";
import {
  runScheduledGovernedPostAnalyticsRefresh,
  SCHEDULED_GOVERNED_ANALYTICS_MAX_CAMPAIGNS_HARD,
  SCHEDULED_GOVERNED_ANALYTICS_MAX_PER_PROVIDER_HARD,
  SCHEDULED_GOVERNED_ANALYTICS_MAX_POSTS_HARD,
  SCHEDULED_GOVERNED_ANALYTICS_MAX_POSTS_PER_CAMPAIGN_HARD,
  SCHEDULED_GOVERNED_ANALYTICS_MAX_SCAN_POOL_LIMIT,
  SCHEDULED_GOVERNED_ANALYTICS_THROTTLE_PAUSE_AFTER_HARD,
  SCHEDULED_GOVERNED_ANALYTICS_THROTTLE_PAUSE_AFTER_MIN,
} from "@/lib/social/run-scheduled-governed-post-analytics-refresh";

const JOB_TYPE = "governed_post_analytics_scheduled_refresh";

const BodySchema = z
  .object({
    scanPoolLimit: z.number().int().min(1).max(SCHEDULED_GOVERNED_ANALYTICS_MAX_SCAN_POOL_LIMIT).optional(),
    maxPosts: z.number().int().min(1).max(SCHEDULED_GOVERNED_ANALYTICS_MAX_POSTS_HARD).optional(),
    maxPostsPerCampaign: z
      .number()
      .int()
      .min(1)
      .max(SCHEDULED_GOVERNED_ANALYTICS_MAX_POSTS_PER_CAMPAIGN_HARD)
      .optional(),
    maxCampaigns: z.number().int().min(1).max(SCHEDULED_GOVERNED_ANALYTICS_MAX_CAMPAIGNS_HARD).optional(),
    maxPerProvider: z.number().int().min(1).max(SCHEDULED_GOVERNED_ANALYTICS_MAX_PER_PROVIDER_HARD).optional(),
    throttlePauseAfter: z
      .number()
      .int()
      .min(SCHEDULED_GOVERNED_ANALYTICS_THROTTLE_PAUSE_AFTER_MIN)
      .max(SCHEDULED_GOVERNED_ANALYTICS_THROTTLE_PAUSE_AFTER_HARD)
      .optional(),
  })
  .strict();

/**
 * POST /api/internal/social/governed-post-analytics-scheduled-refresh
 *
 * Cron / worker: bounded governed post analytics refresh with freshness prioritization,
 * per-provider caps, and throttle backoff (Parts 46–47).
 * Auth: `CRON_SECRET` / `SCHEDULED_PUBLISH_WORKER_SECRET` (same as other internal jobs).
 *
 * Response: normalized internal job payload (`jobType`, `summary`, …) — same pattern as SLA scan / publish-run.
 *
 * Suggested schedule: every 15–60 minutes depending on volume.
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
      /* empty body */
    }

    const db = await getDb();
    const run = await runScheduledGovernedPostAnalyticsRefresh(db, opts);
    const finishedAt = new Date();

    const summaryPayload: Record<string, unknown> = {
      scanPoolLimit: run.scanPoolLimit,
      poolScanned: run.poolScanned,
      eligibleInPool: run.eligibleInPool,
      skippedInPool: run.skippedInPool,
      campaignsInPool: run.campaignsInPool,
      campaignsTouched: run.campaignsTouched,
      attemptedCount: run.attemptedCount,
      succeededCount: run.succeededCount,
      failedCount: run.failedCount,
      throttledCount: run.throttledCount,
      deferredDueToBatchLimit: run.deferredDueToBatchLimit,
      deferredDueToCampaignLimit: run.deferredDueToCampaignLimit,
      deferredDueToMaxCampaigns: run.deferredDueToMaxCampaigns,
      deferredDueToPerProviderCap: run.deferredDueToPerProviderCap,
      deferredDueToProviderBackoff: run.deferredDueToProviderBackoff,
      maxPostsApplied: run.maxPostsApplied,
      maxPostsPerCampaignApplied: run.maxPostsPerCampaignApplied,
      maxCampaignsApplied: run.maxCampaignsApplied,
      maxPerProviderApplied: run.maxPerProviderApplied,
      throttlePauseAfterApplied: run.throttlePauseAfterApplied,
      perProviderSummary: run.perProviderSummary,
      failureSamples: run.failureSamples,
      errors: run.failedCount,
    };

    const boundedErrors: InternalJobBoundedError[] = [];
    for (const s of run.failureSamples) {
      pushBoundedInternalJobError(boundedErrors, {
        message: truncateInternalJobMessage(`${s.code} ${s.postId}: ${s.message}`),
      });
    }
    if (run.failedCount > 0 && boundedErrors.length === 0) {
      pushBoundedInternalJobError(boundedErrors, { message: `Failed refreshes: ${run.failedCount}` });
    }

    const normalized = buildNormalizedInternalJobResult({
      jobType: JOB_TYPE,
      startedAt,
      finishedAt,
      summary: summaryPayload,
      boundedErrors,
    });
    logInternalJobRunStructured(normalized);
    await persistInternalJobRun(db, {
      jobType: JOB_TYPE,
      startedAt,
      finishedAt,
      status: deriveInternalJobRunStatus({ boundedErrors, summary: summaryPayload }),
      summary: summaryPayload,
      errorCount: run.failedCount,
    });

    return NextResponse.json(normalized);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[internal/social/governed-post-analytics-scheduled-refresh]", e);
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
