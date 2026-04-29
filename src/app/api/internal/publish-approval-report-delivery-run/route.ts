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
import { runPublishApprovalReportDeliveryRun } from "@/lib/revenue-os/publish-approval-report-delivery-run";
import { isAuthorizedInternalCronRequest } from "@/lib/social/internal-worker-cron-auth";

const JOB_TYPE = "publish_approval_report_delivery";

const BodySchema = z
  .object({
    scanLimit: z.number().int().positive().max(500).optional(),
  })
  .strict();

/**
 * POST /api/internal/publish-approval-report-delivery-run
 *
 * Cron: notify campaign owners (and optional reviewers) when a compliance report window is due.
 * Auth: same internal worker/cron secrets as other internal routes.
 *
 * Suggested schedule: daily (shortly after UTC midnight) or weekly (Monday).
 */
export async function POST(req: NextRequest) {
  const startedAt = new Date();
  try {
    if (!isAuthorizedInternalCronRequest(req)) {
      return governanceUnauthorizedResponse();
    }

    let scanLimit: number | undefined;
    try {
      const j = (await req.json()) as unknown;
      const p = BodySchema.safeParse(j);
      if (p.success) scanLimit = p.data.scanLimit;
    } catch {
      /* empty body */
    }

    const db = await getDb();
    const run = await runPublishApprovalReportDeliveryRun(db, { scanLimit });
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
    console.error("[internal/publish-approval-report-delivery-run]", e);
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
