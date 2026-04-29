import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthedUserId } from "@/lib/api/auth";
import { getDb } from "@/lib/db";
import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
import { readEffectivePublishApprovalRequiredFromRequest } from "@/lib/social/effective-publish-approval-request";
import { promoteFromSocialStudio } from "@/lib/revenue-os/social-studio-promote-server";
const BodySchema = z.object({
  clientId: z.string().default(""),
  campaignId: z.string().min(1),
  generationRunId: z.string().min(1),
  platformVariantId: z.string().min(1),
  socialMediaAssetId: z.string().uuid().optional().nullable(),
  targetPlatform: z.string().min(1),
  socialAccountId: z.string().uuid().optional().nullable(),
  postMode: z.enum(["draft", "schedule", "publish_now"]),
  scheduledAt: z.string().datetime().optional().nullable(),
  captionOverride: z.string().max(12000).optional().nullable(),
});

/**
 * POST /api/revenue-os/social-studio/promote
 * Promote a Social Studio variant into governed `campaign_posts` (draft / scheduled / or publish-now when supported).
 */
export async function POST(req: NextRequest) {
  const __rosGate = await enforceRevenueOsApiAccess(req);
  if (__rosGate) return __rosGate;
  try {
    const userId = await getAuthedUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() }, { status: 400 });
    }

    const p = parsed.data;
    const scheduledAt = p.scheduledAt?.trim() ? new Date(p.scheduledAt) : null;
    const requireApproval = readEffectivePublishApprovalRequiredFromRequest(req);

    const db = await getDb();
    try {
      const out = await promoteFromSocialStudio(db, String(userId), {
        clientId: p.clientId.trim() || "",
        campaignId: p.campaignId,
        generationRunId: p.generationRunId,
        platformVariantId: p.platformVariantId,
        socialMediaAssetId: p.socialMediaAssetId?.trim() || null,
        targetPlatform: p.targetPlatform,
        socialAccountId: p.socialAccountId?.trim() || null,
        postMode: p.postMode,
        scheduledAt: p.postMode === "schedule" ? scheduledAt : null,
        captionOverride: p.captionOverride?.trim() || null,
        requireApproval,
      });
      return NextResponse.json({
        ...out,
        plannerUrl: `/revenue-os/dashboard#social-studio`,
        postDetailUrl: `/api/social/posts/${out.post.id}`,
      });
    } catch (e) {
      const code = e instanceof Error ? e.message : "UNKNOWN";
      if (code === "NOT_FOUND" || code === "VARIANT_NOT_FOUND" || code === "SOCIAL_ASSET_NOT_FOUND") {
        return NextResponse.json({ error: code, message: "Not found." }, { status: 404 });
      }
      if (code === "FORBIDDEN_ACCOUNT" || code === "CLIENT_MISMATCH") {
        return NextResponse.json({ error: code, message: e instanceof Error ? e.message : "Forbidden" }, { status: 403 });
      }
      throw e;
    }
  } catch (e) {
    console.error("[revenue-os/social-studio/promote]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
