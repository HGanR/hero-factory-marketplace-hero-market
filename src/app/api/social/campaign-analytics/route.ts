import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthedUserId } from "@/lib/api/auth";
import { getDb } from "@/lib/db";
import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
import { getCampaignReviewerAccess } from "@/lib/revenue-os/get-campaign-reviewer-access";
import { buildCampaignGovernedSocialAnalyticsAggregate } from "@/lib/social/governed-post-analytics-aggregate";

const QuerySchema = z.object({
  campaignId: z.string().uuid(),
});

/**
 * GET /api/social/campaign-analytics?campaignId=
 * Campaign + provider rollups from **latest snapshot per published governed post** (read-only).
 */
export async function GET(req: NextRequest) {
  const __rosGate = await enforceRevenueOsApiAccess(req);
  if (__rosGate) return __rosGate;
  try {
    const userId = await getAuthedUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const parsed = QuerySchema.parse({
      campaignId: searchParams.get("campaignId")?.trim(),
    });

    const db = await getDb();
    const access = await getCampaignReviewerAccess(db, userId, parsed.campaignId);
    if (!access) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }

    const aggregate = await buildCampaignGovernedSocialAnalyticsAggregate(db, parsed.campaignId);
    return NextResponse.json({ ok: true, ...aggregate });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "VALIDATION_ERROR", details: e.flatten() }, { status: 400 });
    }
    console.error("[social/campaign-analytics GET]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
