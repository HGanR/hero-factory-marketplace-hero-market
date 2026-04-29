import { NextRequest, NextResponse } from "next/server";
import { runDueScheduledPublishes } from "@/lib/social/run-due-scheduled-publishes";
import { isAuthorizedScheduledPublishRequest } from "@/lib/social/internal-scheduled-publish-auth";

/**
 * POST /api/internal/scheduled-publish/run
 * Cron / worker only — claims due SCHEDULED / RETRY_SCHEDULED posts and publishes.
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

    const summary = await runDueScheduledPublishes({ limit });
    /** Same fields as `RunDueScheduledPublishesSummary` — includes `skippedAwaitingApproval` when approval gate skips due posts. */
    return NextResponse.json({ ok: true, ...summary });
  } catch (e) {
    console.error("[internal/scheduled-publish/run]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
