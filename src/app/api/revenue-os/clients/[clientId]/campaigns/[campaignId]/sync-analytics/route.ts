import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthedUserId } from "@/lib/api/auth";
import { getDb } from "@/lib/db";
import { ensureClientHubTables } from "@/lib/db/client-hub-ensure";
import { assertValidClientId } from "@/lib/revenue-os/client-hub-queries";
import { getCampaignForOwnedClient } from "@/lib/revenue-os/client-hub-campaign-scope";
import { getCampaignReviewerAccess } from "@/lib/revenue-os/get-campaign-reviewer-access";
import {
  insertGovernedPostAnalyticsBatchRefreshAudit,
  runCampaignGovernedPostAnalyticsBatchRefresh,
} from "@/lib/social/governed-post-analytics-batch-refresh";
import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";

const Body = z.object({ limit: z.number().int().min(1).max(50).optional() }).strict();

type Ctx = { params: Promise<{ clientId: string; campaignId: string }> };

/**
 * POST — Client-scoped proxy for governed post analytics refresh.
 */
export async function POST(req: NextRequest, ctx: Ctx) {
  const __rosGate = await enforceRevenueOsApiAccess(req);
  if (__rosGate) return __rosGate;
  try {
    await ensureClientHubTables();
    const userId = await getAuthedUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { clientId, campaignId } = await ctx.params;
    try {
      assertValidClientId(clientId);
    } catch {
      return NextResponse.json({ error: "Invalid client id" }, { status: 400 });
    }
    if (!(await getCampaignForOwnedClient(userId, clientId, campaignId, true))) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const db = await getDb();
    const access = await getCampaignReviewerAccess(db, userId, campaignId);
    if (!access) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const raw = await req.json().catch(() => ({}));
    const parsed = Body.parse(raw);
    const limit = parsed.limit;

    const result = await runCampaignGovernedPostAnalyticsBatchRefresh({
      db,
      userId: String(userId),
      campaignId,
      limit,
    });

    await insertGovernedPostAnalyticsBatchRefreshAudit({
      db,
      userId: String(userId),
      details: {
        source: "client_hub",
        clientId,
        campaignId,
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
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }
    console.error("POST client campaign sync-analytics", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
