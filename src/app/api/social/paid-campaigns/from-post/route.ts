import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthedUserId } from "@/lib/api/auth";
import { getDb } from "@/lib/db";
import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
import { getCampaignReviewerAccess } from "@/lib/revenue-os/get-campaign-reviewer-access";
import { buildPromotionDecisionSummaryForPaidCampaignContext } from "@/lib/social/build-promotion-decision-summary-for-paid-campaign-context";
import {
  createPaidSocialCampaignDraftFromOrganicPost,
  PaidSocialCampaignError,
  projectPaidSocialCampaignPublic,
} from "@/lib/social/paid-social-campaigns";
import type { PaidCampaignSuccessResponse } from "@/lib/social/paid-campaign-api-response-types";

const FromPostBodySchema = z
  .object({
    campaignId: z.string().uuid(),
    postId: z.string().uuid(),
  })
  .strict();

/**
 * POST /api/social/paid-campaigns/from-post
 * Create a Meta ads **draft** from a published organic post (Part 59). Does not launch ads.
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
    const parsed = FromPostBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() }, { status: 400 });
    }

    const db = await getDb();
    const access = await getCampaignReviewerAccess(db, userId, parsed.data.campaignId);
    if (!access) {
      return NextResponse.json({ error: "NOT_FOUND", message: "Campaign not found." }, { status: 404 });
    }

    try {
      const row = await createPaidSocialCampaignDraftFromOrganicPost(db, {
        campaignId: parsed.data.campaignId,
        userId,
        postId: parsed.data.postId,
      });
      const paidCampaign = await projectPaidSocialCampaignPublic(db, row, parsed.data.campaignId);
      const promotionDecisionSummary = await buildPromotionDecisionSummaryForPaidCampaignContext(
        db,
        parsed.data.campaignId
      );
      return NextResponse.json({
        ok: true,
        paidCampaign,
        ...(promotionDecisionSummary ? { promotionDecisionSummary } : {}),
      } satisfies PaidCampaignSuccessResponse);
    } catch (err) {
      if (err instanceof PaidSocialCampaignError) {
        if (err.code === "POST_NOT_IN_CAMPAIGN") {
          return NextResponse.json({ error: "POST_NOT_IN_CAMPAIGN", message: err.message }, { status: 404 });
        }
        if (err.code === "POST_NOT_POSTED") {
          return NextResponse.json({ error: "POST_NOT_POSTED", message: err.message }, { status: 400 });
        }
        if (err.code === "ASSET_NOT_IN_CAMPAIGN") {
          return NextResponse.json({ error: "ASSET_NOT_IN_CAMPAIGN", message: err.message }, { status: 400 });
        }
        if (err.code === "INSERT_FAILED") {
          return NextResponse.json({ error: "INSERT_FAILED" }, { status: 500 });
        }
        if (err.code === "DUPLICATE_REFERENCE_ORGANIC_POST") {
          const d = err.duplicateReference;
          return NextResponse.json(
            {
              ok: false,
              error: "duplicate_reference_organic_post",
              ...(d
                ? {
                    existingCampaignId: d.existingCampaignId,
                    existingDraftId: d.existingDraftId,
                    existingStatus: d.existingStatus,
                    existingName: d.existingName,
                  }
                : {}),
            },
            { status: 409 }
          );
        }
      }
      throw err;
    }
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "VALIDATION_ERROR", details: e.flatten() }, { status: 400 });
    }
    console.error("[social/paid-campaigns/from-post POST]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
