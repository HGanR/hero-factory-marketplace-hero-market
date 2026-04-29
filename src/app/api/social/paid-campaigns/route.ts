import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthedUserId } from "@/lib/api/auth";
import { getDb } from "@/lib/db";
import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
import { getCampaignReviewerAccess } from "@/lib/revenue-os/get-campaign-reviewer-access";
import { buildPromotionDecisionSummaryForPaidCampaignContext } from "@/lib/social/build-promotion-decision-summary-for-paid-campaign-context";
import {
  computePromotionDecisionSummaryForCampaign,
  createPaidSocialCampaignDraft,
  listPaidSocialCampaignsByCampaign,
  PaidSocialCampaignError,
  PaidSocialCreateBodySchema,
  projectPaidSocialCampaignPublic,
  projectPaidSocialCampaignsPublicForList,
} from "@/lib/social/paid-social-campaigns";
import { computePaidSocialRollupForCampaign } from "@/lib/social/paid-social-campaign-paid-rollup";
import { computePaidListSignalsSummary } from "@/lib/social/paid-social-optimization-signals";
import { computeOrganicPromotionOpportunitySummaryForCampaign } from "@/lib/social/organic-performance-signals";
import type {
  PaidCampaignListSuccessResponse,
  PaidCampaignSuccessResponse,
} from "@/lib/social/paid-campaign-api-response-types";

const ListQuerySchema = z.object({
  campaignId: z.string().uuid(),
});

/**
 * GET /api/social/paid-campaigns?campaignId=
 * List paid social campaign drafts for a governed campaign (Revenue OS + reviewer access).
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
    const parsed = ListQuerySchema.safeParse({
      campaignId: searchParams.get("campaignId")?.trim(),
    });
    if (!parsed.success) {
      return NextResponse.json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() }, { status: 400 });
    }

    const db = await getDb();
    const access = await getCampaignReviewerAccess(db, userId, parsed.data.campaignId);
    if (!access) {
      return NextResponse.json({ error: "NOT_FOUND", message: "Campaign not found." }, { status: 404 });
    }

    const rows = await listPaidSocialCampaignsByCampaign(db, parsed.data.campaignId);
    const paidCampaigns = await projectPaidSocialCampaignsPublicForList(db, rows, parsed.data.campaignId);
    const paidRollup = await computePaidSocialRollupForCampaign(db, parsed.data.campaignId);
    const paidListSignalsSummary = computePaidListSignalsSummary(paidCampaigns);
    const organicPromotionOpportunitySummary = await computeOrganicPromotionOpportunitySummaryForCampaign(
      db,
      parsed.data.campaignId
    );
    const promotionDecisionSummary = computePromotionDecisionSummaryForCampaign(paidCampaigns);
    return NextResponse.json({
      ok: true,
      paidCampaigns,
      paidRollup,
      paidListSignalsSummary,
      organicPromotionOpportunitySummary,
      ...(promotionDecisionSummary ? { promotionDecisionSummary } : {}),
    } satisfies PaidCampaignListSuccessResponse);
  } catch (e) {
    console.error("[social/paid-campaigns GET]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/social/paid-campaigns
 * Create a paid social draft (scaffolding — no ad launch).
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
    const parsed = PaidSocialCreateBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() }, { status: 400 });
    }

    const db = await getDb();
    const access = await getCampaignReviewerAccess(db, userId, parsed.data.campaignId);
    if (!access) {
      return NextResponse.json({ error: "NOT_FOUND", message: "Campaign not found." }, { status: 404 });
    }

    try {
      const row = await createPaidSocialCampaignDraft(db, {
        campaignId: parsed.data.campaignId,
        userId,
        provider: parsed.data.provider,
        internalName: parsed.data.internalName,
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
      if (err instanceof PaidSocialCampaignError && err.code === "INVALID_PROVIDER") {
        return NextResponse.json({ error: "INVALID_PROVIDER", message: err.message }, { status: 400 });
      }
      if (err instanceof PaidSocialCampaignError && err.code === "INSERT_FAILED") {
        return NextResponse.json({ error: "INSERT_FAILED" }, { status: 500 });
      }
      throw err;
    }
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "VALIDATION_ERROR", details: e.flatten() }, { status: 400 });
    }
    console.error("[social/paid-campaigns POST]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
