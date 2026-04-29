import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { runDueScheduledPublishes } from "@/lib/social/run-due-scheduled-publishes";
import { isAuthorizedScheduledPublishRequest } from "@/lib/social/internal-scheduled-publish-auth";
import {
  buildNormalizedInternalJobResult,
  deriveInternalJobRunStatus,
  persistInternalJobRun,
  pushBoundedInternalJobError,
  type InternalJobBoundedError,
} from "@/lib/revenue-os/internal-batch-job-run";

const JOB_TYPE = "social_publish_run";

/**
 * POST /api/internal/social/publish-run
 * Cron: due scheduled campaign posts (LinkedIn via provider layer + other adapters). Same auth as scheduled-publish worker.
 */
export async function POST(req: NextRequest) {
  try {
    if (!isAuthorizedScheduledPublishRequest(req)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let limit = 25;
    try {
      const body = await req.json().catch(() => ({}));
      if (body && typeof body === "object" && typeof (body as { limit?: unknown }).limit === "number") {
        limit = (body as { limit: number }).limit;
      }
    } catch {
      /* empty body */
    }

    const startedAt = new Date();
    const summary = await runDueScheduledPublishes({ limit });
    const finishedAt = new Date();

    const summaryPayload: Record<string, unknown> = {
      scanned: summary.scanned,
      attempted: summary.attempted,
      published: summary.published,
      failed: summary.failed,
      retried: summary.retried,
      skipped: summary.skipped,
      skippedAwaitingApproval: summary.skippedAwaitingApproval,
      errors: summary.failed,
    };

    const boundedErrors: InternalJobBoundedError[] = [];
    if (summary.failed > 0) {
      pushBoundedInternalJobError(boundedErrors, { message: `Failed publishes: ${summary.failed}` });
    }

    const normalized = buildNormalizedInternalJobResult({
      jobType: JOB_TYPE,
      startedAt,
      finishedAt,
      summary: summaryPayload,
      boundedErrors,
    });

    const db = await getDb();
    await persistInternalJobRun(db, {
      jobType: JOB_TYPE,
      startedAt,
      finishedAt,
      status: deriveInternalJobRunStatus({ boundedErrors, summary: summaryPayload }),
      summary: summaryPayload,
      errorCount: summary.failed,
    });

    return NextResponse.json(normalized);
  } catch (e) {
    console.error("[internal/social/publish-run]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
