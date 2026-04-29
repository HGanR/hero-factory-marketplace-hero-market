import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { getAuthedUserId } from "@/lib/api/auth";
import { getDb } from "@/lib/db";
import {
  campaigns,
  socialAccounts,
  socialGenerationRuns,
  socialMediaAssets,
  socialPostPlatformVariants,
} from "@/lib/db/schema";
import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
import { getCampaignReviewerAccess } from "@/lib/revenue-os/get-campaign-reviewer-access";
import { buildNativeSocialImageSvg, svgDataUrl, svgToUtf8Buffer } from "@/lib/revenue-os/native-social-asset-image";
import { resolveSocialStudioBrandDefaults } from "@/lib/revenue-os/social-studio-brand-defaults";
import {
  SOCIAL_STUDIO_IMAGE_TEMPLATE_CATALOG,
  type SocialStudioImageTemplateId,
  SOCIAL_STUDIO_IMAGE_TEMPLATE_IDS,
  buildNativeSocialImageSpecForStudioTemplate,
} from "@/lib/revenue-os/social-studio-image-templates";
import { type StudioPlatform } from "@/lib/revenue-os/social-studio-captions";
import { buildPlatformCaptionVariantsMerged, topicFromViralContent } from "@/lib/revenue-os/social-studio-from-viral-content";
import type { ContentEngineOutput } from "@/lib/revenue-os/content-engine-types";
import { uploadFileToIPFS, getIPFSUrl } from "@/lib/marketplace/pinata";
import { connectedSocialPlatformsSet } from "@/lib/social/platform-identity";
import { resolveSocialStudioPublishMode } from "@/lib/revenue-os/bentley-social-studio-hints";

const ContentEngineBodySchema: z.ZodType<ContentEngineOutput> = z.object({
  captions: z.object({
    hook: z.string(),
    authority: z.string(),
    curiosity: z.string(),
    controversial: z.string(),
    shortViral: z.string(),
  }),
  imagePrompts: z.array(z.string()),
  viralIdeas: z.array(z.object({ title: z.string(), description: z.string() })),
  hooks: z.array(z.string()),
  fullPost: z.object({
    caption: z.string(),
    content: z.string(),
    visualPrompt: z.string(),
    hashtags: z.array(z.string()),
  }),
});

const BodySchema = z
  .object({
    campaignId: z.string().min(1),
    clientId: z.string().default(""),
    /** Optional when `contentEngine` is provided — then derived from viral hook/caption. */
    topic: z.string().max(500).optional(),
    /**
     * Generate Viral Content (`ContentEngineSection`) / Bentley content phase output.
     * Drives native SVG copy lines + per-platform variants when present.
     */
    contentEngine: ContentEngineBodySchema.optional(),
    /** Subset; default all four in handler */
    platforms: z
      .array(z.enum(["linkedin", "instagram", "facebook", "tiktok"]))
      .optional(),
    imageTemplate: z
      .string()
      .optional()
      .refine(
        (s) => !s || (SOCIAL_STUDIO_IMAGE_TEMPLATE_IDS as readonly string[]).includes(s),
        { message: "Invalid image template id." }
      ),
    imageAspect: z.enum(["og", "square", "portrait"]).optional(),
  })
  .refine(
    (b) => (b.topic != null && b.topic.trim().length > 0) || b.contentEngine != null,
    { message: "Provide topic or contentEngine (Generate Viral Content output)." }
  );

/**
 * POST /api/revenue-os/social-studio/generate
 * Creates `social_generation_runs`, a native SVG asset row, and per-platform caption variants.
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
      return NextResponse.json(
        { error: "INVALID_BODY", message: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const {
      campaignId,
      clientId,
      topic: topicRaw,
      contentEngine,
      platforms: platformsArg,
      imageTemplate: imageTemplateRaw,
      imageAspect,
    } = parsed.data;
    const topic =
      topicRaw?.trim() ||
      (contentEngine ? topicFromViralContent(contentEngine, "Launch highlight") : "");
    if (!topic) {
      return NextResponse.json(
        { error: "MISSING_TOPIC", message: "topic or contentEngine is required." },
        { status: 400 }
      );
    }
    const db = await getDb();
    const access = await getCampaignReviewerAccess(db, userId, campaignId);
    if (!access) {
      return NextResponse.json({ error: "NOT_FOUND", message: "Campaign not found." }, { status: 404 });
    }

    const campRows = await db
      .select()
      .from(campaigns)
      .where(eq(campaigns.id, campaignId))
      .limit(1);
    const camp = campRows[0];
    if (!camp) {
      return NextResponse.json({ error: "NOT_FOUND", message: "Campaign not found." }, { status: 404 });
    }

    const businessName = typeof camp.name === "string" && camp.name.trim() ? camp.name.trim() : undefined;
    const brand = resolveSocialStudioBrandDefaults(camp);
    const imageTemplate: SocialStudioImageTemplateId = (
      imageTemplateRaw && imageTemplateRaw in SOCIAL_STUDIO_IMAGE_TEMPLATE_CATALOG
        ? imageTemplateRaw
        : "announcement"
    ) as SocialStudioImageTemplateId;

    const allVariants = buildPlatformCaptionVariantsMerged({
      topic,
      businessName,
      contentEngine: contentEngine ?? null,
    });
    const want: StudioPlatform[] = platformsArg?.length
      ? platformsArg
      : (["linkedin", "instagram", "facebook", "tiktok"] as const);
    const variants = allVariants.filter((v) => want.includes(v.platform));

    const runId = crypto.randomUUID();
    const assetId = crypto.randomUUID();
    const now = new Date();

    const imageSpec = buildNativeSocialImageSpecForStudioTemplate({
      templateId: imageTemplate,
      aspect: imageAspect,
      brand,
      topic,
      businessName,
      contentEngine: contentEngine ?? null,
    });
    const svg = buildNativeSocialImageSvg(imageSpec);
    const buf = svgToUtf8Buffer(svg);

    let storageUrl: string | null = null;
    let storageKind: "ipfs_gateway" | "data" = "data";
    let hostPublishReady = false;
    try {
      if (process.env.PINATA_JWT || (process.env.PINATA_API_KEY && process.env.PINATA_SECRET_KEY)) {
        const up = await uploadFileToIPFS(buf, `social-studio-${runId}.svg`, "image/svg+xml");
        storageUrl = getIPFSUrl(up.ipfsHash);
        storageKind = "ipfs_gateway";
        hostPublishReady = true;
      }
    } catch (e) {
      console.warn("[social-studio/generate] Pinata upload skipped:", e);
    }
    if (!storageUrl) {
      storageUrl = svgDataUrl(svg);
      storageKind = "data";
      hostPublishReady = false;
    }

    const accRows = await db
      .select({ platform: socialAccounts.platform, platformCanonical: socialAccounts.platform })
      .from(socialAccounts)
      .where(
        and(eq(socialAccounts.userId, String(userId)), eq(socialAccounts.clientId, clientId.trim() || ""))
      );
    const connected = connectedSocialPlatformsSet(
      accRows.map((a) => ({ platform: a.platform, platformCanonical: null }))
    );
    const publishPlan = resolveSocialStudioPublishMode({
      targetPlatforms: want,
      connectedPlatforms: connected,
    });

    await db.insert(socialGenerationRuns).values({
      id: runId,
      userId: String(userId),
      clientId: clientId.trim() || "",
      campaignId,
      status: "complete",
      topic,
      sourcePrompt: topic,
      metadataJson: {
        platforms: want,
        hostPublishReady,
        publishMode: publishPlan.mode,
        publishPlanLines: publishPlan.lines,
        viralContent: Boolean(contentEngine),
        imageTemplate,
        imageAspect: imageAspect ?? null,
        brandName: brand.brandName,
      },
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(socialMediaAssets).values({
      id: assetId,
      userId: String(userId),
      clientId: clientId.trim() || "",
      campaignId,
      generationRunId: runId,
      assetType: "image",
      sourcePrompt: contentEngine
        ? [topicFromViralContent(contentEngine, topic), contentEngine.fullPost?.visualPrompt].filter(Boolean).join(" — ")
        : topic,
      platformTargetsJson: want,
      generationMetadataJson: {
        kind: "native_svg",
        templateId: imageTemplate,
        imageAspect: imageAspect ?? SOCIAL_STUDIO_IMAGE_TEMPLATE_CATALOG[imageTemplate].defaultAspect,
        brandSnapshot: { brandName: brand.brandName, primaryColor: brand.primaryColor },
        bytes: buf.length,
        pinata: storageKind === "ipfs_gateway",
        contentEngine: Boolean(contentEngine),
        imagePrompt: contentEngine?.imagePrompts?.[0] ?? null,
        visualPrompt: contentEngine?.fullPost?.visualPrompt ?? null,
      },
      width: imageSpec.width,
      height: imageSpec.height,
      aspectRatio: imageSpec.width >= imageSpec.height * 1.2 ? "landscape" : imageSpec.width === imageSpec.height ? "1:1" : "4:5",
      storageUrl,
      storageKind,
      selected: true,
      exportStatus: "ready",
      createdAt: now,
    });

    const variantsWithIds = variants.map((v) => {
      const id = crypto.randomUUID();
      return { ...v, id };
    });
    for (const v of variantsWithIds) {
      await db.insert(socialPostPlatformVariants).values({
        id: v.id,
        userId: String(userId),
        clientId: clientId.trim() || "",
        campaignId,
        generationRunId: runId,
        campaignPostId: null,
        platform: v.platform,
        caption: v.caption,
        hashtags: v.hashtags,
        linkUrl: null,
        imagePrompt: v.imagePrompt,
        socialMediaAssetId: assetId,
        createdAt: now,
      });
    }

    return NextResponse.json({
      runId,
      usedViralContent: Boolean(contentEngine),
      effectiveTopic: topic,
      imageTemplate,
      imageAspect: imageAspect ?? SOCIAL_STUDIO_IMAGE_TEMPLATE_CATALOG[imageTemplate].defaultAspect,
      brand: { name: brand.brandName, primaryColor: brand.primaryColor, secondaryColor: brand.secondaryColor },
      asset: {
        id: assetId,
        storageUrl,
        storageKind,
        hostPublishReady,
        width: imageSpec.width,
        height: imageSpec.height,
      },
      variants: variantsWithIds,
      exportPackage: {
        imageDataUrl: storageKind === "data" ? storageUrl : null,
        svg,
        captions: Object.fromEntries(variants.map((x) => [x.platform, { caption: x.caption, hashtags: x.hashtags }])),
      },
      publishPlan,
      manualMode: publishPlan.mode !== "direct",
    });
  } catch (e) {
    console.error("[revenue-os/social-studio/generate]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
