import { NextRequest, NextResponse } from "next/server";
import { getAuthedUserId } from "@/lib/api/auth";
import { getDb } from "@/lib/db";
import { upgradeBentleyAssetsForCampaign } from "@/lib/revenue-os/bentley-campaign-asset-durable";
import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
import { getCampaignReviewerAccess } from "@/lib/revenue-os/get-campaign-reviewer-access";
import { z } from "zod";

const BodySchema = z.object({
  campaignId: z.string().uuid(),
});

/**
 * POST /api/revenue-os/bentley/upgrade-campaign-assets
 * Batch-upgrade ephemeral Bentley auto-images to Pinata (idempotent).
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
    const parsed = BodySchema.parse(body);
    const db = await getDb();
    const access = await getCampaignReviewerAccess(db, userId, parsed.campaignId);
    if (!access) {
      return NextResponse.json({ error: "NOT_FOUND", message: "Campaign not found." }, { status: 404 });
    }

    const summary = await upgradeBentleyAssetsForCampaign(db, parsed.campaignId);
    return NextResponse.json({ ok: true, ...summary });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json(
        { error: "INVALID_REQUEST", message: "Invalid payload", issues: e.flatten() },
        { status: 400 }
      );
    }
    const msg = e instanceof Error ? e.message : String(e);
    console.warn("[revenue-os/bentley/upgrade-campaign-assets]", msg);
    return NextResponse.json({ error: "UPGRADE_FAILED", message: msg }, { status: 500 });
  }
}
