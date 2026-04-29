import { NextRequest, NextResponse } from "next/server";
import { getAuthedUserId } from "@/lib/api/auth";
import { getDb } from "@/lib/db";
import { campaignPosts } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
import { getCampaignReviewerAccess } from "@/lib/revenue-os/get-campaign-reviewer-access";
import { buildSocialPostAnalyticsPublic } from "@/lib/social/governed-post-analytics-public";

/**
 * GET /api/social/posts/:id/analytics
 * Latest normalized snapshot + small history (no live provider call).
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const __rosGate = await enforceRevenueOsApiAccess(req);
  if (__rosGate) return __rosGate;
  try {
    const userId = await getAuthedUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "MISSING_ID" }, { status: 400 });
    }

    const db = await getDb();
    const postRows = await db.select().from(campaignPosts).where(eq(campaignPosts.id, id)).limit(1);
    const post = postRows[0];
    if (!post) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }

    const access = await getCampaignReviewerAccess(db, userId, post.campaignId);
    if (!access) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }

    const analytics = await buildSocialPostAnalyticsPublic(db, post);
    return NextResponse.json({ analytics });
  } catch (e) {
    console.error("[social/posts/[id]/analytics GET]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
