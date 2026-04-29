import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthedUserId } from "@/lib/api/auth";
import { getDb } from "@/lib/db";
import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
import { getCampaignReviewerAccess } from "@/lib/revenue-os/get-campaign-reviewer-access";
import { buildPromotionDecisionSummaryForPaidCampaignContext } from "@/lib/social/build-promotion-decision-summary-for-paid-campaign-context";
import { executePaidSocialMetaLaunch, PaidSocialLaunchError } from "@/lib/social/paid-social-campaign-launch";
import type { PaidCampaignSuccessResponse } from "@/lib/social/paid-campaign-api-response-types";

const IdParamsSchema = z.object({
  id: z.string().uuid(),
});

const BodySchema = z
  .object({
    campaignId: z.string().uuid(),
  })
  .strict();

/**
 * POST /api/social/paid-campaigns/:id/launch
 * Meta Marketing API create (campaign → ad set → creative → ad). Gated by env flag + readiness.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const __rosGate = await enforceRevenueOsApiAccess(req);
  if (__rosGate) return __rosGate;
  try {
    const userId = await getAuthedUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = IdParamsSchema.parse(await params);
    const body = await req.json().catch(() => ({}));
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() }, { status: 400 });
    }
    const { campaignId } = parsed.data;

    const db = await getDb();
    const access = await getCampaignReviewerAccess(db, userId, campaignId);
    if (!access) {
      return NextResponse.json({ error: "NOT_FOUND", message: "Campaign not found." }, { status: 404 });
    }

    try {
      const out = await executePaidSocialMetaLaunch(db, {
        paidCampaignId: id,
        campaignId,
        userId,
      });
      const promotionDecisionSummary = await buildPromotionDecisionSummaryForPaidCampaignContext(db, campaignId);
      return NextResponse.json({
        ...out,
        ...(promotionDecisionSummary ? { promotionDecisionSummary } : {}),
      } satisfies PaidCampaignSuccessResponse);
    } catch (err) {
      if (err instanceof PaidSocialLaunchError) {
        const status =
          err.code === "LAUNCH_DISABLED"
            ? 403
            : err.code === "NOT_FOUND"
              ? 404
              : err.code === "ALREADY_LAUNCHED" || err.code === "LAUNCH_IN_PROGRESS"
                ? 409
                : err.code === "META_API"
                  ? 502
                  : 400;
        return NextResponse.json(
          { ok: false, error: err.code, message: err.message, details: err.details ?? null },
          { status }
        );
      }
      throw err;
    }
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "VALIDATION_ERROR", details: e.flatten() }, { status: 400 });
    }
    console.error("[social/paid-campaigns/[id]/launch POST]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
