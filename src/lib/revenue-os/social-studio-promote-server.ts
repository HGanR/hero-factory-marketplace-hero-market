import crypto from "crypto";
import { and, eq } from "drizzle-orm";
import {
  loadCampaignPostPublishContext,
  executeCampaignPostAdapterPublish,
  CampaignPostPublishError,
} from "@/lib/social/campaign-post-publish";
import { normalizeScheduledPublishFailure } from "@/lib/social/scheduled-publish-executor";
import { getCampaignReviewerAccess } from "@/lib/revenue-os/get-campaign-reviewer-access";
import { resolvePublishApprovalActor } from "@/lib/revenue-os/resolve-publish-approval-actor";
import { readScheduledPublishRequireApprovalEnv } from "@/lib/revenue-os/publish-approval-gate";
import { canScheduledPostPublishUnderApprovalMode } from "@/lib/revenue-os/publish-approval-gate";
import { seedGovernanceUtmForNewSocialPost } from "@/lib/social/social-post-approval-seed";
import {
  fetchLinkedAssetCreativeTypeMap,
  mapCampaignPostRowToSocialGovernedPublic,
} from "@/lib/social/social-governed-post-public";
import { promoteSocialStudioAssetToCampaignAsset } from "@/lib/revenue-os/social-studio-campaign-asset-bridge";
import { resolveSocialStudioPromoteReadiness, type StudioPostMode } from "@/lib/revenue-os/social-studio-promote-readiness";
import {
  resolveStudioPublishReadiness,
  type StudioPublishReadiness,
} from "@/lib/revenue-os/social-studio-unified-readiness";
import { campaignPosts, campaignAssets, socialAccounts, socialPostPlatformVariants, socialMediaAssets, campaignAuditEvents } from "@/lib/db/schema";
import { persistPublishOutcomeDeploymentFeedback } from "@/lib/revenue-os/deployment-feedback-db";
import { parseScheduledPublishMeta } from "@/lib/social/scheduled-publish-meta";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

export type PromoteFromSocialStudioInput = {
  clientId: string;
  campaignId: string;
  generationRunId: string;
  platformVariantId: string;
  socialMediaAssetId: string | null;
  targetPlatform: string;
  socialAccountId: string | null;
  postMode: StudioPostMode;
  scheduledAt: Date | null;
  captionOverride: string | null;
  /** For governance seed (matches POST /api/social/posts) */
  requireApproval?: boolean;
};

export type PromoteFromSocialStudioResult = {
  ok: true;
  post: ReturnType<typeof mapCampaignPostRowToSocialGovernedPublic> & { id: string };
  resolvedMode: "draft" | "scheduled" | "published" | "draft_downgraded";
  warnings: string[];
  readiness: ReturnType<typeof resolveSocialStudioPromoteReadiness>;
  campaignAssetId: string | null;
  alreadyPromoted?: boolean;
};

/**
 * Load studio rows, bridge asset, create governed `campaign_posts` row, optional immediate publish.
 * Reuses approval seeding + UTM from existing social post creation.
 */
export async function promoteFromSocialStudio(
  db: Db,
  userId: string,
  input: PromoteFromSocialStudioInput
): Promise<PromoteFromSocialStudioResult> {
  const access = await getCampaignReviewerAccess(db, Number(userId), input.campaignId);
  if (!access) {
    throw new Error("NOT_FOUND");
  }
  const camp = access.campaign;
  if (String(camp.clientId ?? "") !== String(input.clientId ?? "").trim()) {
    throw new Error("CLIENT_MISMATCH");
  }

  const vRows = await db
    .select()
    .from(socialPostPlatformVariants)
    .where(
      and(
        eq(socialPostPlatformVariants.id, input.platformVariantId),
        eq(socialPostPlatformVariants.userId, String(userId)),
        eq(socialPostPlatformVariants.campaignId, input.campaignId),
        eq(socialPostPlatformVariants.generationRunId, input.generationRunId)
      )
    )
    .limit(1);
  const variant = vRows[0];
  if (!variant) {
    throw new Error("VARIANT_NOT_FOUND");
  }
  if (variant.campaignPostId?.trim()) {
    const ex = await db.select().from(campaignPosts).where(eq(campaignPosts.id, variant.campaignPostId!)).limit(1);
    if (ex[0]) {
      const connectedAccRows = await db
        .select()
        .from(socialAccounts)
        .where(
          and(
            eq(socialAccounts.userId, String(userId)),
            eq(socialAccounts.clientId, String(camp.clientId ?? ""))
          )
        );
      let accForReadiness: (typeof socialAccounts.$inferSelect) | null = null;
      if (ex[0].socialAccountId?.trim()) {
        const a = await db
          .select()
          .from(socialAccounts)
          .where(eq(socialAccounts.id, ex[0].socialAccountId.trim()))
          .limit(1);
        accForReadiness = a[0] ?? null;
      }
      const platformEarly = String(
        input.targetPlatform || ex[0].platform || variant.platform || ""
      )
        .trim()
        .toLowerCase();
      const creativeMap = await fetchLinkedAssetCreativeTypeMap(db, [ex[0].assetId]);
      const ct = ex[0].assetId ? creativeMap[ex[0].assetId!] ?? null : null;
      const r0 = resolveSocialStudioPromoteReadiness({
        targetPlatform: platformEarly,
        socialAccount: accForReadiness,
        postMode: "draft",
        campaignAssetId: ex[0].assetId,
        assetCreativeType: ct,
        hasHostedHttpsAssetUrl: true,
        treatAsHasStorageUrlForValidation: true,
      });
      const studioReadiness = resolveStudioPublishReadiness({
        targetPlatform: platformEarly,
        socialAccount: accForReadiness,
        postMode: "draft",
        scheduledAtIso: null,
        campaignAssetId: ex[0].assetId,
        assetCreativeType: ct,
        hasHostedHttpsAssetUrl: true,
        treatAsHasStorageUrlForValidation: true,
        connectedAccountRows: connectedAccRows,
        governanceRequiresApproval: input.requireApproval ?? false,
      });
      return {
        ok: true,
        post: mapCampaignPostRowToSocialGovernedPublic(ex[0], {
          linkedAssetCreativeType: ex[0].assetId ? creativeMap[ex[0].assetId!] ?? null : null,
        }) as PromoteFromSocialStudioResult["post"],
        resolvedMode: "draft",
        warnings: ["This Social Studio variant was already promoted — returning existing post."],
        readiness: r0,
        studioReadiness,
        campaignAssetId: ex[0].assetId ?? null,
        alreadyPromoted: true,
      };
    }
  }

  let sAsset: typeof socialMediaAssets.$inferSelect | null = null;
  const sid = (input.socialMediaAssetId || variant.socialMediaAssetId || "").trim();
  if (sid) {
    const a = await db
      .select()
      .from(socialMediaAssets)
      .where(
        and(
          eq(socialMediaAssets.id, sid),
          eq(socialMediaAssets.campaignId, input.campaignId),
          eq(socialMediaAssets.userId, String(userId))
        )
      )
      .limit(1);
    sAsset = a[0] ?? null;
  }

  if (!sAsset) {
    throw new Error("SOCIAL_ASSET_NOT_FOUND");
  }

  const platform = String(input.targetPlatform || variant.platform || "")
    .trim()
    .toLowerCase();

  const bridge = await promoteSocialStudioAssetToCampaignAsset(db, {
    userId: String(userId),
    campaignId: input.campaignId,
    socialAsset: sAsset,
    targetPlatform: platform,
  });

  const caption =
    (input.captionOverride?.trim() || variant.caption || "").trim() || "(empty caption)";
  const hashtags = variant.hashtags?.trim() || "";

  let accountRow: typeof socialAccounts.$inferSelect | null = null;
  if (input.socialAccountId?.trim()) {
    const ar = await db
      .select()
      .from(socialAccounts)
      .where(eq(socialAccounts.id, input.socialAccountId.trim()))
      .limit(1);
    const acc = ar[0];
    if (acc) {
      if (String(acc.userId) !== String(userId)) {
        throw new Error("FORBIDDEN_ACCOUNT");
      }
      if (String(acc.clientId) !== String(camp.clientId)) {
        throw new Error("CLIENT_MISMATCH");
      }
      accountRow = acc;
    }
  }

  const connectedAccRows = await db
    .select()
    .from(socialAccounts)
    .where(
      and(
        eq(socialAccounts.userId, String(userId)),
        eq(socialAccounts.clientId, String(camp.clientId ?? ""))
      )
    );
  const assetRows = await db
    .select()
    .from(campaignAssets)
    .where(eq(campaignAssets.id, bridge.campaignAssetId))
    .limit(1);
  const creativeType = assetRows[0]?.creativeType ?? "IMAGE";
  const treatHasUrl = Boolean(bridge.hostedMediaOk && bridge.storageUrl);

  const readiness = resolveSocialStudioPromoteReadiness({
    targetPlatform: platform,
    socialAccount: accountRow,
    postMode: input.postMode,
    scheduledAtIso: input.postMode === "schedule" ? input.scheduledAt?.toISOString() ?? null : null,
    campaignAssetId: bridge.campaignAssetId,
    assetCreativeType: creativeType,
    hasHostedHttpsAssetUrl: treatHasUrl,
    treatAsHasStorageUrlForValidation: treatHasUrl,
  });

  const warnings = [...readiness.warnings, ...(bridge.publishMediaWarning ? [bridge.publishMediaWarning] : [])];
  if (readiness.mediaMessage) warnings.push(readiness.mediaMessage);

  const requireApproval = input.requireApproval ?? false;
  const studioReadiness = resolveStudioPublishReadiness({
    targetPlatform: platform,
    socialAccount: accountRow,
    postMode: input.postMode,
    scheduledAtIso: input.postMode === "schedule" ? input.scheduledAt?.toISOString() ?? null : null,
    campaignAssetId: bridge.campaignAssetId,
    assetCreativeType: creativeType,
    hasHostedHttpsAssetUrl: treatHasUrl,
    treatAsHasStorageUrlForValidation: treatHasUrl,
    connectedAccountRows: connectedAccRows,
    governanceRequiresApproval: requireApproval,
  });
  for (const line of studioReadiness.publishMode.lines) {
    if (!warnings.includes(line)) warnings.push(line);
  }
  const actor = await resolvePublishApprovalActor({
    campaignOwnerUserId: camp.userId,
    campaignReviewerRole: access.reviewerRole,
  });
  const nowIso = new Date().toISOString();
  const utmBase = seedGovernanceUtmForNewSocialPost({
    requireApproval,
    campaignPublishApprovalChainJson: camp.publishApprovalChainJson,
    actor,
    nowIso,
  });
  const utm = {
    ...utmBase,
    from_social_studio: "1",
    social_studio_run_id: input.generationRunId,
    social_studio_variant_id: input.platformVariantId,
    social_studio_source: "1",
  };

  const isOwner = String(camp.userId) === String(userId);
  const approvalGate = canScheduledPostPublishUnderApprovalMode({
    requireApproval: readScheduledPublishRequireApprovalEnv(),
    utmParams: utm,
  });

  let scheduledAt: Date | null = input.scheduledAt;
  let status: "DRAFT" | "SCHEDULED" = "DRAFT";
  let scheduledPublishMeta: Record<string, unknown> | null = null;

  if (readiness.manualOnlyPlatform) {
    scheduledAt = null;
    status = "DRAFT";
    warnings.push("In-app schedule/publish is not available for this network — created as governed draft. Use export to post natively.");
  } else if (input.postMode === "schedule") {
    if (!input.scheduledAt) {
      warnings.push("Schedule time missing — created as draft.");
    } else if (readiness.mediaBlocked || !readiness.scheduleReady) {
      warnings.push("Media or account validation failed — created as draft. Fix in social composer.");
      scheduledAt = null;
    } else if (accountRow && readiness.adapterPublishSupported) {
      status = "SCHEDULED";
      scheduledPublishMeta = { scheduledPublishSource: "manual_schedule" as const };
    } else {
      warnings.push("Could not schedule — missing account or unsupported platform. Saved as draft.");
      scheduledAt = null;
    }
  } else {
    scheduledAt = null;
  }

  if (input.postMode === "publish_now" && !isOwner) {
    warnings.push("Only the campaign owner can use publish-now — saved as draft.");
  }
  if (input.postMode === "publish_now" && isOwner && !approvalGate.ok) {
    warnings.push(`Publish requires approval: ${approvalGate.reason}`);
  }

  if (input.postMode === "publish_now") {
    warnings.push(
      "Content360 centralized (platform API key) publishing is not available from Social Studio publish-now. Use admin Launch Campaigns with platform schedule, or publish natively via your connected account.",
    );
  }

  const shouldTryPublish =
    input.postMode === "publish_now" &&
    isOwner &&
    approvalGate.ok &&
    readiness.publishNowReady &&
    Boolean(accountRow) &&
    !readiness.manualOnlyPlatform &&
    !(
      scheduledPublishMeta &&
      parseScheduledPublishMeta(scheduledPublishMeta).publishRoute === "content360"
    );

  if (input.postMode === "publish_now" && isOwner && !readiness.publishNowReady) {
    warnings.push("Direct publish is not available — check connection, hosted media, and capabilities. Saved as draft.");
  }

  const postId = crypto.randomUUID();

  await db.insert(campaignPosts).values({
    id: postId,
    campaignId: input.campaignId,
    assetId: bridge.campaignAssetId,
    platform,
    scheduledAt: scheduledAt ?? null,
    status,
    caption: hashtags ? `${caption}\n\n${hashtags}` : caption,
    linkUrl: variant.linkUrl?.trim() || null,
    utmParams: utm,
    scheduledPublishMeta,
    socialAccountId: accountRow?.id ?? null,
  });

  await db
    .update(socialPostPlatformVariants)
    .set({ campaignPostId: postId })
    .where(eq(socialPostPlatformVariants.id, input.platformVariantId));

  await db.insert(campaignAuditEvents).values({
    id: crypto.randomUUID(),
    userId: String(userId),
    postId,
    action: "social_studio_promote",
    platform,
    details: { generationRunId: input.generationRunId, socialMediaAssetId: sAsset.id, postMode: input.postMode, status },
  });

  let resolvedMode: PromoteFromSocialStudioResult["resolvedMode"] = "draft";
  if (status === "SCHEDULED") resolvedMode = "scheduled";
  if (input.postMode === "draft") resolvedMode = "draft";
  if ((input.postMode === "schedule" || input.postMode === "publish_now") && status === "DRAFT" && !shouldTryPublish) {
    resolvedMode = "draft_downgraded";
  }

  if (shouldTryPublish) {
    await db
      .update(campaignPosts)
      .set({ status: "PUBLISHING", updatedAt: new Date() })
      .where(eq(campaignPosts.id, postId));
    try {
      const ctx = await loadCampaignPostPublishContext(db, postId);
      if (!ctx) throw new CampaignPostPublishError("POST_NOT_FOUND", "Post not found after insert.");
      const result = await executeCampaignPostAdapterPublish(ctx);
      await db
        .update(campaignPosts)
        .set({
          status: "POSTED",
          platformPostId: result.platformPostId,
          postedAt: new Date(),
          errorMessage: null,
          scheduledPublishMeta: {},
          updatedAt: new Date(),
        })
        .where(eq(campaignPosts.id, postId));
      await db.insert(campaignAuditEvents).values({
        id: crypto.randomUUID(),
        userId: String(userId),
        postId,
        action: "publish",
        platform: ctx.platformKey,
        details: { source: "social_studio_promote" },
      });
      await persistPublishOutcomeDeploymentFeedback(db, {
        userId: String(userId),
        campaignId: input.campaignId,
        campaignPostId: postId,
        platform: ctx.platformKey,
        outcome: "published",
        source: "manual_publish",
        publishedAt: new Date(),
        platformPostId: result.platformPostId,
      });
      const posted = (await db.select().from(campaignPosts).where(eq(campaignPosts.id, postId)).limit(1))[0]!;
      const creativeMap2 = await fetchLinkedAssetCreativeTypeMap(db, [posted.assetId]);
      return {
        ok: true,
        post: mapCampaignPostRowToSocialGovernedPublic(posted, {
          linkedAssetCreativeType: posted.assetId ? creativeMap2[posted.assetId!] ?? null : null,
        }) as PromoteFromSocialStudioResult["post"],
        resolvedMode: "published",
        warnings,
        readiness,
        campaignAssetId: bridge.campaignAssetId,
      };
    } catch (err) {
      const norm =
        err instanceof CampaignPostPublishError
          ? normalizeScheduledPublishFailure(err, err.code)
          : normalizeScheduledPublishFailure(err);
      await db
        .update(campaignPosts)
        .set({ status: "FAILED", errorMessage: norm.message, updatedAt: new Date() })
        .where(eq(campaignPosts.id, postId));
      warnings.push(`Publish failed: ${norm.message}`);
    }
  }

  const finalRow = (await db.select().from(campaignPosts).where(eq(campaignPosts.id, postId)).limit(1))[0]!;
  const creativeMap3 = await fetchLinkedAssetCreativeTypeMap(db, [finalRow.assetId]);
  return {
    ok: true,
    post: mapCampaignPostRowToSocialGovernedPublic(finalRow, {
      linkedAssetCreativeType: finalRow.assetId ? creativeMap3[finalRow.assetId!] ?? null : null,
    }) as PromoteFromSocialStudioResult["post"],
    resolvedMode,
    warnings,
    readiness,
    studioReadiness,
    campaignAssetId: bridge.campaignAssetId,
  };
}
