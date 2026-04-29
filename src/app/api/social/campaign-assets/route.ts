import { NextRequest, NextResponse } from "next/server";
import { getAuthedUserId } from "@/lib/api/auth";
import { getDb } from "@/lib/db";
import { campaignAssets } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
import { getCampaignReviewerAccess } from "@/lib/revenue-os/get-campaign-reviewer-access";
import { projectCampaignAssetMetadata } from "@/lib/social/campaign-asset-metadata";
import { normalizeCampaignCreativeType } from "@/lib/social/social-provider-publish-capabilities";

/**
 * GET /api/social/campaign-assets?campaignId=
 * List campaign assets for governed social composer. No raw storage URLs in response.
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
    const campaignId = searchParams.get("campaignId")?.trim() || "";
    if (!campaignId) {
      return NextResponse.json(
        { error: "MISSING_CAMPAIGN_ID", message: "campaignId query required." },
        { status: 400 }
      );
    }

    const db = await getDb();
    const access = await getCampaignReviewerAccess(db, userId, campaignId);
    if (!access) {
      return NextResponse.json({ error: "NOT_FOUND", message: "Campaign not found." }, { status: 404 });
    }

    const rows = await db
      .select({
        id: campaignAssets.id,
        creativeType: campaignAssets.creativeType,
        storageUrl: campaignAssets.storageUrl,
        metadata: campaignAssets.metadata,
        createdAt: campaignAssets.createdAt,
      })
      .from(campaignAssets)
      .where(eq(campaignAssets.campaignId, campaignId))
      .orderBy(desc(campaignAssets.createdAt))
      .limit(200);

    const assets = rows.map((r) => {
      const hasStorageUrl = Boolean(r.storageUrl?.trim());
      const meta = projectCampaignAssetMetadata(r.metadata);
      const ct = normalizeCampaignCreativeType(r.creativeType);
      const instagramPublishEligible =
        hasStorageUrl && (ct === "IMAGE" || ct === "VIDEO");
      const facebookImageEligible = hasStorageUrl && ct === "IMAGE";
      return {
        id: r.id,
        creativeType: r.creativeType,
        hasStorageUrl,
        label: `${r.creativeType}${hasStorageUrl ? "" : " (no file URL)"}`,
        mimeType: meta.mimeType,
        extension: meta.extension,
        width: meta.width,
        height: meta.height,
        durationSeconds: meta.durationSeconds,
        instagramPublishEligible,
        facebookImageEligible,
        linkedinAttachmentNote:
          ct === "IMAGE" || ct === "VIDEO"
            ? "LinkedIn publish still uses text/link in-app today; asset stored for future use."
            : null,
      };
    });

    return NextResponse.json({ assets });
  } catch (e) {
    console.error("[social/campaign-assets GET]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
