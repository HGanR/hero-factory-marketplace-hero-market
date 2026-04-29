import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthedUserId } from "@/lib/api/auth";
import { getDb } from "@/lib/db";
import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
import { getCampaignReviewerAccess } from "@/lib/revenue-os/get-campaign-reviewer-access";
import { buildPromotionDecisionSummaryForPaidCampaignContext } from "@/lib/social/build-promotion-decision-summary-for-paid-campaign-context";
import {
  getPaidSocialCampaignById,
  PaidSocialCampaignError,
  PaidSocialPatchBodySchema,
  patchPaidSocialCampaign,
  projectPaidSocialCampaignPublic,
} from "@/lib/social/paid-social-campaigns";
import type { PaidCampaignSuccessResponse } from "@/lib/social/paid-campaign-api-response-types";

const IdParamsSchema = z.object({
  id: z.string().uuid(),
});

function mapPaidSocialError(err: PaidSocialCampaignError): NextResponse {
  switch (err.code) {
    case "NOT_FOUND":
      return NextResponse.json({ error: "NOT_FOUND", message: "Paid campaign not found." }, { status: 404 });
    case "ASSET_NOT_IN_CAMPAIGN":
      return NextResponse.json(
        { error: "ASSET_NOT_IN_CAMPAIGN", message: "Linked asset must belong to this campaign." },
        { status: 400 }
      );
    case "POST_NOT_IN_CAMPAIGN":
      return NextResponse.json(
        { error: "POST_NOT_IN_CAMPAIGN", message: "Referenced post must belong to this campaign." },
        { status: 400 }
      );
    case "INVALID_FB_SOCIAL_ACCOUNT":
      return NextResponse.json(
        { error: "INVALID_FB_SOCIAL_ACCOUNT", message: err.message },
        { status: 400 }
      );
    default:
      return NextResponse.json({ error: err.code, message: err.message }, { status: 400 });
  }
}

/**
 * GET /api/social/paid-campaigns/:id?campaignId=
 * Single draft; `campaignId` required for access scope check.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const __rosGate = await enforceRevenueOsApiAccess(req);
  if (__rosGate) return __rosGate;
  try {
    const userId = await getAuthedUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = IdParamsSchema.parse(await params);
    const { searchParams } = new URL(req.url);
    const campaignId = searchParams.get("campaignId")?.trim() || "";
    if (!z.string().uuid().safeParse(campaignId).success) {
      return NextResponse.json({ error: "VALIDATION_ERROR", message: "campaignId query (uuid) required." }, { status: 400 });
    }

    const db = await getDb();
    const access = await getCampaignReviewerAccess(db, userId, campaignId);
    if (!access) {
      return NextResponse.json({ error: "NOT_FOUND", message: "Campaign not found." }, { status: 404 });
    }

    const row = await getPaidSocialCampaignById(db, id);
    if (!row || row.campaignId !== campaignId) {
      return NextResponse.json({ error: "NOT_FOUND", message: "Paid campaign not found." }, { status: 404 });
    }

    const paidCampaign = await projectPaidSocialCampaignPublic(db, row, campaignId);
    const promotionDecisionSummary = await buildPromotionDecisionSummaryForPaidCampaignContext(db, campaignId);
    return NextResponse.json({
      ok: true,
      paidCampaign,
      ...(promotionDecisionSummary ? { promotionDecisionSummary } : {}),
    } satisfies PaidCampaignSuccessResponse);
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "VALIDATION_ERROR", details: e.flatten() }, { status: 400 });
    }
    console.error("[social/paid-campaigns/[id] GET]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * PATCH /api/social/paid-campaigns/:id
 * Iterative draft edit. Body must include `campaignId` for access + linkage checks.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const __rosGate = await enforceRevenueOsApiAccess(req);
  if (__rosGate) return __rosGate;
  try {
    const userId = await getAuthedUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = IdParamsSchema.parse(await params);
    const body = await req.json();
    const BodySchema = PaidSocialPatchBodySchema.extend({
      campaignId: z.string().uuid(),
    }).strict();
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() }, { status: 400 });
    }
    const { campaignId, ...patch } = parsed.data;

    const db = await getDb();
    const access = await getCampaignReviewerAccess(db, userId, campaignId);
    if (!access) {
      return NextResponse.json({ error: "NOT_FOUND", message: "Campaign not found." }, { status: 404 });
    }

    try {
      const row = await patchPaidSocialCampaign(db, { id, campaignId, userId, patch });
      const paidCampaign = await projectPaidSocialCampaignPublic(db, row, campaignId);
      const promotionDecisionSummary = await buildPromotionDecisionSummaryForPaidCampaignContext(db, campaignId);
      return NextResponse.json({
        ok: true,
        paidCampaign,
        ...(promotionDecisionSummary ? { promotionDecisionSummary } : {}),
      } satisfies PaidCampaignSuccessResponse);
    } catch (err) {
      if (err instanceof PaidSocialCampaignError) {
        return mapPaidSocialError(err);
      }
      throw err;
    }
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "VALIDATION_ERROR", details: e.flatten() }, { status: 400 });
    }
    console.error("[social/paid-campaigns/[id] PATCH]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
