import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { extractExternalSocialReviewToken } from "@/lib/social/external-social-review-http";
import {
  listExternalSocialReviewPostsForTokenContext,
  resolveExternalSocialReviewTokenContext,
} from "@/lib/social/external-social-publish-approval";

/**
 * GET /api/external/social-publish-approval/posts
 * Bearer token or `?token=` — lists governed social posts for the campaign (narrow fields).
 */
export async function GET(req: NextRequest) {
  try {
    const raw = extractExternalSocialReviewToken(req);
    if (!raw) {
      return NextResponse.json(
        { error: "MISSING_TOKEN", message: "Provide Authorization: Bearer <token> or ?token=" },
        { status: 401 }
      );
    }
    const db = await getDb();
    const ctx = await resolveExternalSocialReviewTokenContext(db, raw);
    if (!ctx) {
      return NextResponse.json(
        { error: "INVALID_TOKEN", message: "Link is invalid, revoked, or expired." },
        { status: 401 }
      );
    }
    const posts = await listExternalSocialReviewPostsForTokenContext({ db, ctx });
    const actionable = posts.filter((p) => p.canDecide);
    return NextResponse.json({
      ok: true,
      campaignName: ctx.campaign.name?.trim() || null,
      reviewLabel: ctx.tokenRow.label?.trim() || null,
      posts,
      actionableCount: actionable.length,
    });
  } catch (e) {
    console.error("[external/social-publish-approval/posts GET]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
