import { NextRequest, NextResponse } from "next/server";
import { getAuthedUserId } from "@/lib/api/auth";
import { getDb } from "@/lib/db";
import { runPostOptimizationMemoryRefreshForUser } from "@/lib/revenue-os/run-post-optimization-memory-refresh";

import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
/**
 * POST /api/revenue-os/post-optimization-memory/refresh
 * User-scoped rebuild (bounded). Prefer cron/internal sweep for bulk.
 */
export async function POST(req: NextRequest) {
  const __rosGate = await enforceRevenueOsApiAccess(req);
  if (__rosGate) return __rosGate;
  try {
    const userId = await getAuthedUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let clientId: string | undefined;
    let feedbackLimit = 120;
    try {
      const body = await req.json().catch(() => ({}));
      if (body && typeof body === "object") {
        const b = body as { clientId?: unknown; feedbackLimit?: unknown };
        if (typeof b.clientId === "string") clientId = b.clientId.trim() || undefined;
        if (typeof b.feedbackLimit === "number") feedbackLimit = b.feedbackLimit;
      }
    } catch {
      /* empty */
    }

    feedbackLimit = Math.min(Math.max(feedbackLimit, 1), 200);

    const db = await getDb();
    const summary = await runPostOptimizationMemoryRefreshForUser(db, {
      userId: String(userId),
      clientId,
      feedbackLimit,
    });

    return NextResponse.json({ ok: true, ...summary });
  } catch (e) {
    console.error("[revenue-os/post-optimization-memory/refresh]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
