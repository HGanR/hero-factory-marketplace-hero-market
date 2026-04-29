import { NextRequest, NextResponse } from "next/server";
import { getAuthedUserId } from "@/lib/api/auth";
import { getDb } from "@/lib/db";
import { campaignPosts } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
import { getCampaignReviewerAccess } from "@/lib/revenue-os/get-campaign-reviewer-access";
import { refreshGovernedPostAnalytics } from "@/lib/social/governed-post-analytics-refresh";
import { buildSocialPostAnalyticsPublic } from "@/lib/social/governed-post-analytics-public";

/**
 * POST /api/social/posts/:id/analytics/refresh
 * On-demand provider fetch for one published governed post (access-checked).
 */
export async function POST(
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

    const result = await refreshGovernedPostAnalytics({ db, userId: String(userId), postId: id });

    if (!result.ok) {
      const status =
        result.code === "not_found"
          ? 404
          : result.code === "forbidden"
            ? 403
            : 200;
      return NextResponse.json(
        {
          ok: false,
          code: result.code,
          message: result.message,
          detail: result.detail ?? null,
        },
        { status }
      );
    }

    const freshPost = await db.select().from(campaignPosts).where(eq(campaignPosts.id, id)).limit(1);
    const analytics = freshPost[0] ? await buildSocialPostAnalyticsPublic(db, freshPost[0]) : null;

    return NextResponse.json({
      ok: true,
      snapshot: result.snapshot,
      analytics,
    });
  } catch (e) {
    console.error("[social/posts/[id]/analytics/refresh POST]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
