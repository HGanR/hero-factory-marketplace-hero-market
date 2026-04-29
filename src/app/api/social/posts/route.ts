import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getAuthedUserId } from "@/lib/api/auth";
import { getDb } from "@/lib/db";
import { campaignPosts, campaignAssets, socialAccounts } from "@/lib/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
import { getCampaignReviewerAccess } from "@/lib/revenue-os/get-campaign-reviewer-access";
import { resolvePublishApprovalActor } from "@/lib/revenue-os/resolve-publish-approval-actor";
import { readEffectivePublishApprovalRequiredFromRequest } from "@/lib/social/effective-publish-approval-request";
import { seedGovernanceUtmForNewSocialPost } from "@/lib/social/social-post-approval-seed";
import {
  fetchLinkedAssetCreativeTypeMap,
  mapCampaignPostRowToSocialGovernedPublic,
} from "@/lib/social/social-governed-post-public";
import { validateComposerSocialPostMedia } from "@/lib/social/social-post-create-rules";

const CreateSocialPostSchema = z.object({
  provider: z.enum(["linkedin", "facebook", "instagram"]),
  campaignId: z.string().min(1),
  accountId: z.string().uuid(),
  content: z.string().min(1).max(12000),
  scheduledFor: z.string().datetime().optional(),
  linkUrl: z.string().url().optional().or(z.literal("")),
  /** Campaign asset — IMAGE/VIDEO for Instagram; optional IMAGE for Facebook; ignored by LinkedIn adapter today. */
  assetId: z.string().uuid().optional().nullable(),
});

/**
 * GET /api/social/posts?campaignId=…&provider=linkedin
 * List governed social posts for a campaign (campaign_posts as source of truth).
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
    const provider = searchParams.get("provider")?.trim().toLowerCase() || "";
    if (!campaignId) {
      return NextResponse.json({ error: "MISSING_CAMPAIGN_ID", message: "campaignId query required." }, { status: 400 });
    }

    const db = await getDb();
    const access = await getCampaignReviewerAccess(db, userId, campaignId);
    if (!access) {
      return NextResponse.json({ error: "NOT_FOUND", message: "Campaign not found." }, { status: 404 });
    }

    const whereParts = [eq(campaignPosts.campaignId, campaignId)];
    if (provider) whereParts.push(eq(campaignPosts.platform, provider));

    const rows = await db
      .select()
      .from(campaignPosts)
      .where(whereParts.length === 1 ? whereParts[0] : and(...whereParts))
      .orderBy(desc(campaignPosts.createdAt))
      .limit(100);

    const creativeMap = await fetchLinkedAssetCreativeTypeMap(
      db,
      rows.map((r) => r.assetId)
    );
    const posts = rows.map((r) =>
      mapCampaignPostRowToSocialGovernedPublic(r, {
        linkedAssetCreativeType: r.assetId ? creativeMap[r.assetId] ?? null : null,
      })
    );
    return NextResponse.json({ posts });
  } catch (e) {
    console.error("[social/posts GET]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/social/posts
 * Create a governed social post row (LinkedIn, Facebook Page, or Instagram Business) with governance UTM seeding.
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
    const parsed = CreateSocialPostSchema.parse(body);

    const db = await getDb();
    const access = await getCampaignReviewerAccess(db, userId, parsed.campaignId);
    if (!access) {
      return NextResponse.json({ error: "NOT_FOUND", message: "Campaign not found." }, { status: 404 });
    }

    const camp = access.campaign;
    const accRows = await db
      .select()
      .from(socialAccounts)
      .where(eq(socialAccounts.id, parsed.accountId))
      .limit(1);
    const acc = accRows[0];
    if (!acc || acc.platform !== parsed.provider) {
      return NextResponse.json(
        { error: "INVALID_ACCOUNT", message: "Social account not found or provider mismatch." },
        { status: 400 }
      );
    }
    if (String(acc.userId) !== String(userId)) {
      return NextResponse.json(
        { error: "FORBIDDEN_ACCOUNT", message: "Use a social connection you authorized." },
        { status: 403 }
      );
    }
    if (String(acc.clientId) !== String(camp.clientId)) {
      return NextResponse.json(
        { error: "CLIENT_MISMATCH", message: "Account client scope does not match this campaign." },
        { status: 400 }
      );
    }

    let assetCreativeType: string | null = null;
    let hasStorageUrl = false;
    if (parsed.assetId) {
      const assetRows = await db
        .select()
        .from(campaignAssets)
        .where(and(eq(campaignAssets.id, parsed.assetId), eq(campaignAssets.campaignId, parsed.campaignId)))
        .limit(1);
      if (!assetRows[0]) {
        return NextResponse.json(
          { error: "INVALID_ASSET", message: "Asset not found for this campaign." },
          { status: 400 }
        );
      }
      assetCreativeType = assetRows[0].creativeType ?? null;
      hasStorageUrl = Boolean(assetRows[0].storageUrl?.trim());
    }

    const mediaVal = validateComposerSocialPostMedia({
      provider: parsed.provider,
      scheduledFor: parsed.scheduledFor,
      assetId: parsed.assetId,
      assetCreativeType,
      hasStorageUrl: parsed.assetId ? hasStorageUrl : false,
    });
    if (!mediaVal.ok) {
      return NextResponse.json({ error: mediaVal.code, message: mediaVal.message }, { status: 400 });
    }

    const scheduledAt = parsed.scheduledFor ? new Date(parsed.scheduledFor) : null;
    const requireApproval = readEffectivePublishApprovalRequiredFromRequest(req);
    const actor = await resolvePublishApprovalActor({
      campaignOwnerUserId: camp.userId,
      campaignReviewerRole: access.reviewerRole,
    });
    const nowIso = new Date().toISOString();
    const utmParams = seedGovernanceUtmForNewSocialPost({
      requireApproval,
      campaignPublishApprovalChainJson: camp.publishApprovalChainJson,
      actor,
      nowIso,
    });

    const postId = crypto.randomUUID();
    const scheduledPublishMeta = scheduledAt ? { scheduledPublishSource: "manual_schedule" as const } : null;

    await db.insert(campaignPosts).values({
      id: postId,
      campaignId: parsed.campaignId,
      assetId: parsed.assetId ?? null,
      platform: parsed.provider,
      scheduledAt,
      status: scheduledAt ? "SCHEDULED" : "DRAFT",
      caption: parsed.content,
      linkUrl: parsed.linkUrl?.trim() || null,
      utmParams,
      scheduledPublishMeta,
      socialAccountId: parsed.accountId,
    });

    const inserted = await db.select().from(campaignPosts).where(eq(campaignPosts.id, postId)).limit(1);
    const row = inserted[0];
    const creativeMap = await fetchLinkedAssetCreativeTypeMap(db, [row.assetId]);
    const linked = row.assetId ? creativeMap[row.assetId] ?? null : null;
    const post = mapCampaignPostRowToSocialGovernedPublic(row, { linkedAssetCreativeType: linked });

    return NextResponse.json({
      ok: true,
      post,
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "VALIDATION_ERROR", details: e.flatten() }, { status: 400 });
    }
    console.error("[social/posts POST]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
