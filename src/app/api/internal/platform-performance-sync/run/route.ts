import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedInternalCronRequest } from "@/lib/social/internal-worker-cron-auth";
import { runPlatformPerformanceSync } from "@/lib/social/run-platform-performance-sync";
import { getDb } from "@/lib/db";

/**
 * POST /api/internal/platform-performance-sync/run
 * Cron / worker — syncs metrics for recent POSTED campaign posts (additive feedback rows).
 */
export async function POST(req: NextRequest) {
  try {
    if (!isAuthorizedInternalCronRequest(req)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let limit = 25;
    let userId: string | undefined;
    try {
      const body = await req.json().catch(() => ({}));
      if (body && typeof body === "object") {
        const b = body as { limit?: unknown; userId?: unknown };
        if (typeof b.limit === "number") limit = b.limit;
        if (typeof b.userId === "string" && b.userId.trim()) userId = b.userId.trim();
      }
    } catch {
      /* empty body */
    }

    const db = await getDb();
    const summary = await runPlatformPerformanceSync(db, { limit, userId });
    return NextResponse.json({ ok: true, ...summary });
  } catch (e) {
    console.error("[internal/platform-performance-sync/run]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
