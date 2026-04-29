import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { campaignPosts, socialAccounts } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { extractExternalSocialReviewToken } from "@/lib/social/external-social-review-http";
import {
  buildExternalSocialReviewPostDto,
  resolveExternalSocialReviewTokenContext,
} from "@/lib/social/external-social-publish-approval";
import { fetchLinkedAssetCreativeTypeMap } from "@/lib/social/social-governed-post-public";
import { defaultSocialAccountLabelForPlatform } from "@/lib/social/social-governed-platforms";

/**
 * GET /api/external/social-publish-approval/posts/:postId
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  try {
    const raw = extractExternalSocialReviewToken(req);
    if (!raw) {
      return NextResponse.json(
        { error: "MISSING_TOKEN", message: "Provide Authorization: Bearer <token> or ?token=" },
        { status: 401 }
      );
    }
    const { postId } = await params;
    if (!postId) {
      return NextResponse.json({ error: "MISSING_ID" }, { status: 400 });
    }

    const db = await getDb();
    const ctx = await resolveExternalSocialReviewTokenContext(db, raw);
    if (!ctx) {
      return NextResponse.json(
        { error: "INVALID_TOKEN", message: "Link is invalid, revoked, or expired." },
        { status: 401 }
      );
    }

    const postRows = await db.select().from(campaignPosts).where(eq(campaignPosts.id, postId)).limit(1);
    const post = postRows[0];
    if (!post || post.campaignId !== ctx.campaign.id) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }

    const socialAccountDisplayById: Record<string, string> = {};
    if (post.socialAccountId) {
      const acc = await db.select().from(socialAccounts).where(eq(socialAccounts.id, post.socialAccountId)).limit(1);
      if (acc[0]) {
        socialAccountDisplayById[acc[0].id] =
          acc[0].displayName?.trim() || defaultSocialAccountLabelForPlatform(acc[0].platform);
      }
    }
    const creativeTypeByAssetId = await fetchLinkedAssetCreativeTypeMap(db, [post.assetId]);

    const dto = await buildExternalSocialReviewPostDto({
      db,
      post,
      campaign: ctx.campaign,
      allowedRoles: ctx.allowedRoles,
      socialAccountDisplayById,
      creativeTypeByAssetId,
    });

    return NextResponse.json({ ok: true, post: dto });
  } catch (e) {
    console.error("[external/social-publish-approval/posts/[postId] GET]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
