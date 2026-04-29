import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, eq, desc } from "drizzle-orm";
import { getAuthedUserId } from "@/lib/api/auth";
import { getDb } from "@/lib/db";
import { campaignPosts, campaigns } from "@/lib/db/schema";
import { ensureClientHubTables } from "@/lib/db/client-hub-ensure";
import { assertValidClientId } from "@/lib/revenue-os/client-hub-queries";
import { getCampaignForOwnedClient } from "@/lib/revenue-os/client-hub-campaign-scope";
import {
  createPaidSocialCampaignDraftFromOrganicPost,
  PaidSocialCampaignError,
  projectPaidSocialCampaignPublic,
} from "@/lib/social/paid-social-campaigns";
import { buildPromotionDecisionSummaryForPaidCampaignContext } from "@/lib/social/build-promotion-decision-summary-for-paid-campaign-context";
import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";

const Body = z.object({ postId: z.string().uuid().optional() }).strict();

type Ctx = { params: Promise<{ clientId: string; campaignId: string }> };

/**
 * POST — Create a paid social draft from an organic post (client + campaign must match a owned client id).
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
    const [camp] = await db
      .select()
      .from(campaigns)
      .where(and(eq(campaigns.id, campaignId), eq(campaigns.userId, String(userId))))
      .limit(1);
    if (!camp) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const raw = await req.json().catch(() => ({}));
    const parsed = Body.parse(raw);
    let postId = parsed.postId ?? null;
    if (!postId) {
      const posted = await db
        .select({ id: campaignPosts.id })
        .from(campaignPosts)
        .where(and(eq(campaignPosts.campaignId, campaignId), eq(campaignPosts.status, "POSTED")))
        .orderBy(desc(campaignPosts.postedAt))
        .limit(1);
      postId = posted[0]?.id ?? null;
    }
    if (!postId) {
      return NextResponse.json(
        { error: "NO_POSTED_POSTS", message: "No POSTED social posts in this campaign to promote." },
        { status: 400 }
      );
    }

    try {
      const row = await createPaidSocialCampaignDraftFromOrganicPost(db, {
        campaignId,
        userId,
        postId,
      });
      const paidCampaign = await projectPaidSocialCampaignPublic(db, row, campaignId);
      const promotionDecisionSummary = await buildPromotionDecisionSummaryForPaidCampaignContext(db, campaignId);
      return NextResponse.json({
        ok: true,
        postId,
        paidCampaign,
        ...(promotionDecisionSummary ? { promotionDecisionSummary } : {}),
      });
    } catch (err) {
      if (err instanceof PaidSocialCampaignError) {
        if (err.code === "POST_NOT_IN_CAMPAIGN" || err.code === "ASSET_NOT_IN_CAMPAIGN") {
          return NextResponse.json({ error: err.code, message: err.message }, { status: 404 });
        }
        if (err.code === "POST_NOT_POSTED") {
          return NextResponse.json({ error: err.code, message: err.message }, { status: 400 });
        }
        if (err.code === "DUPLICATE_REFERENCE_ORGANIC_POST") {
          const d = err.duplicateReference;
          return NextResponse.json(
            {
              error: "duplicate_reference_organic_post",
              message: err.message,
              ...(d
                ? {
                    existingDraftId: d.existingDraftId,
                    existingName: d.existingName,
                  }
                : {}),
            },
            { status: 409 },
          );
        }
        if (err.code === "INSERT_FAILED") {
          return NextResponse.json({ error: "INSERT_FAILED" }, { status: 500 });
        }
      }
      throw err;
    }
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }
    console.error("POST client campaign promote-post", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
