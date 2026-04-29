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
import { runPublishApprovalSlaScanAllCampaigns } from "@/lib/revenue-os/publish-approval-sla-scan-batch";
import { isAuthorizedInternalCronRequest } from "@/lib/social/internal-worker-cron-auth";

const JOB_TYPE = "publish_approval_sla_scan_all";

const BodySchema = z.object({
  /** Override env gate (for tests); default follows `BENTLEY_SCHEDULED_PUBLISH_REQUIRE_APPROVAL`. */
  workerRequiresApproval: z.boolean().optional(),
  /** Max campaigns to fully scan this run (clamped 1–200). */
  maxCampaigns: z.number().int().positive().optional(),
  /** Max post rows to read for campaign discovery (clamped 200–20000). */
  maxPostProbeRows: z.number().int().positive().optional(),
});

/**
 * POST /api/internal/publish-approval-sla-scan-all
 *
 * Worker/cron entry: batched SLA reminder pass across campaigns with pending approval.
 * Auth: same as other internal cron routes (`SCHEDULED_PUBLISH_WORKER_SECRET` / `CRON_SECRET` via
 * `x-scheduled-publish-secret`, `x-cron-secret`, or `Authorization: Bearer …`).
 *
 * **Suggested schedule:** hourly (or more often if operator volume is high). No platform cron is wired in-repo;
 * invoke from your scheduler (Vercel cron, Cloud Scheduler, etc.).
 */
export async function POST(req: NextRequest) {
  const startedAt = new Date();
  try {
    if (!isAuthorizedInternalCronRequest(req)) {
      return governanceUnauthorizedResponse();
    }

    let body: z.infer<typeof BodySchema> = {};
    try {
      const j = (await req.json()) as unknown;
      const parsed = BodySchema.safeParse(j);
      if (parsed.success) body = parsed.data;
    } catch {
      /* empty body */
    }

    const db = await getDb();
    const run = await runPublishApprovalSlaScanAllCampaigns(db, {
      workerRequiresApproval: body.workerRequiresApproval,
      maxCampaigns: body.maxCampaigns,
      maxPostProbeRows: body.maxPostProbeRows,
    });
    const finishedAt = new Date();
    const { boundedErrors, ...summaryMetrics } = run;
    const normalized = buildNormalizedInternalJobResult({
      jobType: JOB_TYPE,
      startedAt,
      finishedAt,
      summary: { ...summaryMetrics } as Record<string, unknown>,
      boundedErrors,
    });
    logInternalJobRunStructured(normalized);
    await persistInternalJobRun(db, {
      jobType: JOB_TYPE,
      startedAt,
      finishedAt,
      status: deriveInternalJobRunStatus({
        boundedErrors,
        summary: summaryMetrics as Record<string, unknown>,
      }),
      summary: summaryMetrics as Record<string, unknown>,
      errorCount: run.errors,
    });

    return NextResponse.json(normalized);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[internal/publish-approval-sla-scan-all]", e);
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
