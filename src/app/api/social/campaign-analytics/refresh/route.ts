import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthedUserId } from "@/lib/api/auth";
import { getDb } from "@/lib/db";
import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
import { getCampaignReviewerAccess } from "@/lib/revenue-os/get-campaign-reviewer-access";
import {
  insertGovernedPostAnalyticsBatchRefreshAudit,
  runCampaignGovernedPostAnalyticsBatchRefresh,
} from "@/lib/social/governed-post-analytics-batch-refresh";

const BodySchema = z.object({
  campaignId: z.string().uuid(),
  limit: z.number().int().min(1).max(50).optional(),
});

/**
 * POST /api/social/campaign-analytics/refresh
 * Bounded batch refresh for published governed posts (live adapters only). One summary audit row per request.
 */
export async function POST(req: NextRequest) {
  const __rosGate = await enforceRevenueOsApiAccess(req);
  if (__rosGate) return __rosGate;
  try {
    const userId = await getAuthedUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = BodySchema.parse(body);

    const db = await getDb();
    const access = await getCampaignReviewerAccess(db, userId, parsed.campaignId);
    if (!access) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }

    const result = await runCampaignGovernedPostAnalyticsBatchRefresh({
      db,
      userId: String(userId),
      campaignId: parsed.campaignId,
      limit: parsed.limit,
    });

    await insertGovernedPostAnalyticsBatchRefreshAudit({
      db,
      userId: String(userId),
      details: {
        source: "operator_api",
        campaignId: parsed.campaignId,
        attemptedCount: result.attemptedCount,
        succeededCount: result.succeededCount,
        failedCount: result.failedCount,
        skippedCount: result.skippedCount,
        limit: result.limitApplied,
        skippedBreakdown: result.skippedBreakdown,
        durationMs: result.durationMs,
      },
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "VALIDATION_ERROR", details: e.flatten() }, { status: 400 });
    }
    console.error("[social/campaign-analytics/refresh POST]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
