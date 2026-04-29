import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { getAuthedUserId } from "@/lib/api/auth";
import { getDb } from "@/lib/db";
import {
  governanceInternalErrorResponse,
  governanceUnauthorizedResponse,
} from "@/lib/revenue-os/campaign-governance-http-response";
import { listRecentInternalJobRuns } from "@/lib/revenue-os/internal-batch-job-run";
import { isAuthorizedInternalCronRequest } from "@/lib/social/internal-worker-cron-auth";

const QuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  jobType: z.string().max(64).optional(),
});

async function canReadInternalJobRuns(req: NextRequest): Promise<boolean> {
  if (isAuthorizedInternalCronRequest(req)) return true;
  const userId = await getAuthedUserId();
  if (!userId) return false;
  const cookieStore = await cookies();
  return Boolean(cookieStore.get("admin-token")?.value?.trim());
}

/**
 * GET /api/internal/job-runs/recent
 *
 * Recent persisted internal batch job runs (Part 26). Auth: internal cron secret **or** signed-in admin session.
 */
export async function GET(req: NextRequest) {
  try {
    if (!(await canReadInternalJobRuns(req))) {
      return governanceUnauthorizedResponse();
    }

    const { searchParams } = new URL(req.url);
    const parsed = QuerySchema.safeParse({
      limit: searchParams.get("limit") ?? undefined,
      jobType: searchParams.get("jobType") ?? undefined,
    });
    const limit = parsed.success ? parsed.data.limit : undefined;
    const jobType = parsed.success ? parsed.data.jobType : undefined;

    const db = await getDb();
    const rows = await listRecentInternalJobRuns(db, { limit, jobType });

    return NextResponse.json({
      ok: true,
      runs: rows.map((r) => ({
        id: r.id,
        jobType: r.jobType,
        startedAt: r.startedAt instanceof Date ? r.startedAt.toISOString() : String(r.startedAt),
        finishedAt: r.finishedAt instanceof Date ? r.finishedAt.toISOString() : String(r.finishedAt),
        status: r.status,
        summary: r.summaryJson,
        errorCount: r.errorCount,
        createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
      })),
    });
  } catch (e) {
    console.error("[internal/job-runs/recent]", e);
    return governanceInternalErrorResponse();
  }
}
