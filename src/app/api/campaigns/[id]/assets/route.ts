import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getAuthedUserId } from "@/lib/api/auth";
import { getDb } from "@/lib/db";
import { campaignAssets } from "@/lib/db/schema";
import { getCampaignReviewerAccess } from "@/lib/revenue-os/get-campaign-reviewer-access";
import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
import { uploadFileToIPFS, ipfsToHttp } from "@/lib/marketplace/pinata";
import {
  inferCampaignCreativeType,
  validateBentleyCampaignAssetUpload,
} from "@/lib/revenue-os/bentley-campaign-asset-upload-validation";

export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * POST /api/campaigns/:id/assets
 * Multipart: `file` (required), `platform` (required for validation), optional `postId` (audit only).
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const __rosGate = await enforceRevenueOsApiAccess(req);
  if (__rosGate) return __rosGate;
  try {
    const userId = await getAuthedUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: campaignId } = await params;
    if (!campaignId?.trim()) {
      return NextResponse.json({ error: "MISSING_CAMPAIGN_ID" }, { status: 400 });
    }

    const form = await req.formData();
    const file = form.get("file");
    const platformRaw = form.get("platform");
    const postIdRaw = form.get("postId");
    const platform = typeof platformRaw === "string" ? platformRaw.trim().toLowerCase() : "";
    const postId = typeof postIdRaw === "string" ? postIdRaw.trim() : "";

    if (!platform) {
      return NextResponse.json(
        { error: "MISSING_PLATFORM", message: "Form field `platform` is required." },
        { status: 400 }
      );
    }

    if (!(file instanceof File) || file.size <= 0) {
      return NextResponse.json({ error: "MISSING_FILE", message: "Form field `file` is required." }, { status: 400 });
    }

    const v = validateBentleyCampaignAssetUpload({ platform, file });
    if (!v.ok) {
      return NextResponse.json({ error: v.code, message: v.message }, { status: 400 });
    }

    const creativeType = inferCampaignCreativeType(file);
    if (creativeType === "OTHER") {
      return NextResponse.json(
        {
          error: "UNSUPPORTED_MEDIA",
          message: "Upload an image or video file (recognized MIME type).",
        },
        { status: 400 }
      );
    }

    const db = await getDb();
    const access = await getCampaignReviewerAccess(db, userId, campaignId);
    if (!access) {
      return NextResponse.json({ error: "NOT_FOUND", message: "Campaign not found." }, { status: 404 });
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const uploaded = await uploadFileToIPFS(buf, file.name || "upload", file.type || undefined);
    const storageUrl = ipfsToHttp(`ipfs://${uploaded.ipfsHash}`);

    const assetId = crypto.randomUUID();
    await db.insert(campaignAssets).values({
      id: assetId,
      campaignId,
      creativeType,
      storageUrl,
      metadata: {
        source: "bentley_execution_tile",
        platform,
        ...(postId ? { post_id: postId } : {}),
        original_filename: file.name,
        mime_type: file.type,
        size_bytes: file.size,
      },
    });

    return NextResponse.json({
      ok: true,
      assetId,
      creativeType,
      storageUrl,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[campaigns/[id]/assets POST]", msg);
    return NextResponse.json({ error: "UPLOAD_FAILED", message: msg }, { status: 500 });
  }
}
