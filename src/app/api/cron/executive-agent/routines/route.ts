import { NextRequest, NextResponse } from "next/server";
import type { MySql2Database } from "drizzle-orm/mysql2";
import * as schema from "@/lib/db/schema";
import { getDb } from "@/lib/db";
import { isAuthorizedInternalCronRequest } from "@/lib/social/internal-worker-cron-auth";
import { runDueExecutiveRoutinesForCron } from "@/lib/executive-agent/executive-routine-runner";

export const dynamic = "force-dynamic";

/**
 * POST /api/cron/executive-agent/routines
 * Auth: CRON_SECRET / SCHEDULED_PUBLISH_WORKER_SECRET (same headers as other internal cron jobs).
 */
export async function POST(req: NextRequest) {
  if (!isAuthorizedInternalCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const db = (await getDb()) as MySql2Database<typeof schema>;
    const summary = await runDueExecutiveRoutinesForCron(db, new Date());
    return NextResponse.json({
      ok: true,
      processed: summary.processed,
      results: summary.results,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: "CRON_ROUTINES_FAILED", message: msg }, { status: 500 });
  }
}
