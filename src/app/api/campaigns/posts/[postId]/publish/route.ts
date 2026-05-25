import { NextRequest, NextResponse } from "next/server";
import { getAuthedUserId } from "@/lib/api/auth";
import { getDb } from "@/lib/db";
import { runManualCampaignPostPublishCore } from "@/lib/social/campaign-post-manual-publish-core";
import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";

/**
 * POST /api/campaigns/posts/:postId/publish
 * Publish now (manual). Scheduled worker uses the same adapter path internally.
 *
 * `publishRoute === "content360"`: uses platform Content360 API key (server-only) and requires
 * an active **platform admin** session (`admin-token` with `isAdmin`), even if the campaign
 * belongs to another marketplace user.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  const __rosGate = await enforceRevenueOsApiAccess(req);
  if (__rosGate) return __rosGate;
  try {
    const userId = await getAuthedUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { postId } = await params;
    if (!postId) {
      return NextResponse.json({ error: "Missing postId" }, { status: 400 });
    }

    const db = await getDb();
    const adminTok = req.cookies.get("admin-token")?.value;
    const out = await runManualCampaignPostPublishCore({
      userId,
      postId,
      adminTokenCookie: adminTok,
      db,
    });
    return NextResponse.json(out.body, { status: out.status });
  } catch (e) {
    console.error("[campaigns/posts/publish]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
