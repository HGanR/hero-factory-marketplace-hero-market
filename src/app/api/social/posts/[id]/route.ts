import { NextRequest, NextResponse } from "next/server";
import { getAuthedUserId } from "@/lib/api/auth";
import { getDb } from "@/lib/db";
import { campaignPosts, campaignAuditEvents, socialAccounts, campaignAssets } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
import { getCampaignReviewerAccess } from "@/lib/revenue-os/get-campaign-reviewer-access";
import { mergeScheduledPublishMeta, parseScheduledPublishMeta } from "@/lib/social/scheduled-publish-meta";
import {
  fetchLinkedAssetCreativeTypeMap,
  mapCampaignPostRowToSocialGovernedPublic,
} from "@/lib/social/social-governed-post-public";
import { validateComposerSocialPostMedia } from "@/lib/social/social-post-create-rules";
import { buildSocialPostDetailObservability } from "@/lib/social/social-post-detail-observability";
import { listSocialPostTimelineAuditRows } from "@/lib/social/social-post-audit-query";
import { readScheduledPublishRequireApprovalEnv } from "@/lib/revenue-os/publish-approval-gate";
import { parsePublishApprovalFromUtm } from "@/lib/revenue-os/publish-approval-utm";
import { resolvePublishApprovalActor } from "@/lib/revenue-os/resolve-publish-approval-actor";
import {
  getSocialPostEditCapabilities,
  mergeUtmAfterSocialPostEdit,
  socialPostMaterialFieldsChanged,
} from "@/lib/social/social-post-governance-edit";
import { planSocialPostPatchAuditRows, truncateForAudit } from "@/lib/social/social-post-patch-audit";
import { defaultSocialAccountLabelForPlatform } from "@/lib/social/social-governed-platforms";
import { buildSocialPostAnalyticsPublic } from "@/lib/social/governed-post-analytics-public";
import { deriveOrganicPerformanceSignals } from "@/lib/social/organic-performance-signals";
import {
  existingPaidPromotionProjectionFromRow,
  findNonArchivedPaidDraftReferencingOrganicPost,
} from "@/lib/social/paid-social-campaigns";

const PatchSocialPostSchema = z
  .object({
    content: z.string().min(1).max(12000).optional(),
    scheduledFor: z.string().datetime().optional().nullable(),
    linkUrl: z.string().url().optional().or(z.literal("")).nullable(),
    accountId: z.string().uuid().optional().nullable(),
    assetId: z.string().uuid().optional().nullable(),
    /** Re-enter review after rejection (governance merge — pending when approval required, not_required otherwise). */
    resubmitForApproval: z.boolean().optional(),
  })
  .refine(
    (o) =>
      o.content !== undefined ||
      o.scheduledFor !== undefined ||
      o.linkUrl !== undefined ||
      o.accountId !== undefined ||
      o.assetId !== undefined ||
      o.resubmitForApproval === true,
    { message: "At least one field or resubmitForApproval is required." }
  );

function utmRecord(utmParams: unknown): Record<string, string> {
  if (!utmParams || typeof utmParams !== "object" || Array.isArray(utmParams)) return {};
  const o: Record<string, string> = {};
  for (const [k, v] of Object.entries(utmParams as Record<string, unknown>)) {
    if (v == null) continue;
    o[k] = String(v);
  }
  return o;
}

function iso(d: Date | string | null | undefined): string | null {
  if (d == null) return null;
  if (d instanceof Date) return d.toISOString();
  return String(d);
}

/**
 * GET /api/social/posts/:id
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const __rosGate = await enforceRevenueOsApiAccess(req);
  if (__rosGate) return __rosGate;
  try {
    const userId = await getAuthedUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "MISSING_ID" }, { status: 400 });
    }

    const db = await getDb();
    const postRows = await db.select().from(campaignPosts).where(eq(campaignPosts.id, id)).limit(1);
    const post = postRows[0];
    if (!post) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }

    const access = await getCampaignReviewerAccess(db, userId, post.campaignId);
    if (!access) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }

    let socialAccountDisplayById: Record<string, string> = {};
    if (post.socialAccountId) {
      const acc = await db.select().from(socialAccounts).where(eq(socialAccounts.id, post.socialAccountId)).limit(1);
      if (acc[0]) {
        socialAccountDisplayById[acc[0].id] =
          acc[0].displayName?.trim() || defaultSocialAccountLabelForPlatform(acc[0].platform);
      }
    }

    const auditRows = await listSocialPostTimelineAuditRows(db, { postId: id });

    const creativeMap = await fetchLinkedAssetCreativeTypeMap(db, [post.assetId]);
    const linkedAssetCreativeType = post.assetId ? creativeMap[post.assetId] ?? null : null;

    const { plannerItem, approvalDetail, publishDetail, activityTimeline } = buildSocialPostDetailObservability({
      post,
      socialAccountDisplayById,
      auditRows,
      linkedAssetCreativeType,
    });

    const analytics = await buildSocialPostAnalyticsPublic(db, post);

    const metrics = analytics.latest?.metrics ?? null;
    const signalsResult =
      metrics != null
        ? deriveOrganicPerformanceSignals(metrics)
        : { signals: [] as { code: string; label: string; hint: string }[], candidateForPromotion: false };

    const eligible = String(post.status).toUpperCase() === "POSTED";

    const organicPromotion: {
      eligible: boolean;
      signals: typeof signalsResult.signals;
      candidateForPromotion: boolean;
      existingPromotion?: ReturnType<typeof existingPaidPromotionProjectionFromRow>;
    } = {
      eligible,
      signals: signalsResult.signals,
      candidateForPromotion: signalsResult.candidateForPromotion,
    };

    const url = new URL(req.url);
    const campaignIdParam = url.searchParams.get("campaignId")?.trim() ?? "";
    if (campaignIdParam) {
      const parsedCamp = z.string().uuid().safeParse(campaignIdParam);
      if (parsedCamp.success && parsedCamp.data === post.campaignId) {
        const dupRow = await findNonArchivedPaidDraftReferencingOrganicPost(db, post.campaignId, id);
        organicPromotion.existingPromotion = existingPaidPromotionProjectionFromRow(dupRow);
      }
    }

    return NextResponse.json({
      post: mapCampaignPostRowToSocialGovernedPublic(post, { linkedAssetCreativeType }),
      plannerItem,
      approvalDetail,
      publishDetail,
      activityTimeline,
      analytics,
      organicPromotion,
      /** Newest-first; see `SOCIAL_ACTIVITY_TIMELINE_ORDER` in social-publish-observability.ts */
      activityTimelineOrder: "newest_first" as const,
    });
  } catch (e) {
    console.error("[social/posts/[id] GET]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * PATCH /api/social/posts/:id
 * Update draft/scheduled copy, schedule, or pinned account; optional resubmit after rejection; material edits reset approval when required.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const __rosGate = await enforceRevenueOsApiAccess(req);
  if (__rosGate) return __rosGate;
  try {
    const userId = await getAuthedUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "MISSING_ID" }, { status: 400 });
    }

    const body = await req.json();
    const parsed = PatchSocialPostSchema.parse(body);

    const db = await getDb();
    const postRows = await db.select().from(campaignPosts).where(eq(campaignPosts.id, id)).limit(1);
    const post = postRows[0];
    if (!post) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }

    if (post.status === "POSTED" || post.status === "PUBLISHING") {
      return NextResponse.json(
        { error: "IMMUTABLE", message: "Post already published or publishing." },
        { status: 400 }
      );
    }

    const access = await getCampaignReviewerAccess(db, userId, post.campaignId);
    if (!access) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }

    const workerRequiresApproval = readScheduledPublishRequireApprovalEnv();
    const caps = getSocialPostEditCapabilities({ post, workerRequiresApproval });

    const touchesContent = parsed.content !== undefined;
    const touchesSchedule = parsed.scheduledFor !== undefined;
    const touchesAccount = parsed.accountId !== undefined;
    const touchesLink = parsed.linkUrl !== undefined;
    const touchesAsset = parsed.assetId !== undefined;

    if (
      caps.readOnly &&
      (touchesContent || touchesSchedule || touchesAccount || touchesLink || touchesAsset || parsed.resubmitForApproval)
    ) {
      return NextResponse.json({ error: "READ_ONLY", message: caps.readOnlyReason ?? "This post cannot be edited." }, { status: 400 });
    }

    if (touchesContent && !caps.canEditContent) {
      return NextResponse.json({ error: "FORBIDDEN_EDIT", message: "Content cannot be edited in this state." }, { status: 403 });
    }
    if (touchesSchedule && !caps.canEditSchedule) {
      return NextResponse.json({ error: "FORBIDDEN_EDIT", message: "Schedule cannot be edited in this state." }, { status: 403 });
    }
    if (touchesAccount && !caps.canEditAccount) {
      return NextResponse.json({ error: "FORBIDDEN_EDIT", message: "Account cannot be edited in this state." }, { status: 403 });
    }
    if (touchesAsset && !caps.canEditAsset) {
      return NextResponse.json({ error: "FORBIDDEN_EDIT", message: "Media asset cannot be edited in this state." }, { status: 403 });
    }

    if (parsed.resubmitForApproval) {
      if (!caps.canResubmitAfterRejection || parsePublishApprovalFromUtm(utmRecord(post.utmParams)).status !== "rejected") {
        return NextResponse.json(
          { error: "RESUBMIT_NOT_ALLOWED", message: "Resubmit is only available for rejected posts." },
          { status: 400 }
        );
      }
    }

    let nextSocialAccountId: string | null | undefined = undefined;
    if (parsed.accountId !== undefined) {
      if (parsed.accountId === null) {
        nextSocialAccountId = null;
      } else {
        const accRows = await db.select().from(socialAccounts).where(eq(socialAccounts.id, parsed.accountId)).limit(1);
        const acc = accRows[0];
        if (!acc || acc.platform !== post.platform) {
          return NextResponse.json({ error: "INVALID_ACCOUNT", message: "Account must match post provider." }, { status: 400 });
        }
        if (String(acc.userId) !== String(userId)) {
          return NextResponse.json({ error: "FORBIDDEN_ACCOUNT" }, { status: 403 });
        }
        if (String(acc.clientId) !== String(access.campaign.clientId)) {
          return NextResponse.json({ error: "CLIENT_MISMATCH" }, { status: 400 });
        }
        nextSocialAccountId = parsed.accountId;
      }
    }

    let nextAssetIdField: string | null | undefined = undefined;
    if (parsed.assetId !== undefined) {
      if (parsed.assetId === null) {
        nextAssetIdField = null;
      } else {
        const assetRows = await db
          .select()
          .from(campaignAssets)
          .where(and(eq(campaignAssets.id, parsed.assetId), eq(campaignAssets.campaignId, post.campaignId)))
          .limit(1);
        if (!assetRows[0]) {
          return NextResponse.json(
            { error: "INVALID_ASSET", message: "Asset not found for this campaign." },
            { status: 400 }
          );
        }
        nextAssetIdField = parsed.assetId;
      }
    }

    const nextCaption = parsed.content !== undefined ? parsed.content : post.caption ?? "";
    const nextLink = parsed.linkUrl !== undefined ? parsed.linkUrl?.trim() || null : post.linkUrl;
    const nextAccount = nextSocialAccountId !== undefined ? nextSocialAccountId : post.socialAccountId;
    const nextAssetId = nextAssetIdField !== undefined ? nextAssetIdField : post.assetId;

    const resultingScheduledIso =
      parsed.scheduledFor !== undefined
        ? parsed.scheduledFor === null
          ? null
          : new Date(parsed.scheduledFor).toISOString()
        : iso(post.scheduledAt);

    let mergeAssetCreative: string | null = null;
    let mergeHasStorage = false;
    if (nextAssetId?.trim()) {
      const ar = await db.select().from(campaignAssets).where(eq(campaignAssets.id, nextAssetId.trim())).limit(1);
      if (ar[0]) {
        mergeAssetCreative = ar[0].creativeType ?? null;
        mergeHasStorage = Boolean(ar[0].storageUrl?.trim());
      }
    }
    const mediaVal = validateComposerSocialPostMedia({
      provider: post.platform,
      scheduledFor: resultingScheduledIso,
      assetId: nextAssetId,
      assetCreativeType: mergeAssetCreative,
      hasStorageUrl: nextAssetId?.trim() ? mergeHasStorage : false,
    });
    if (!mediaVal.ok) {
      return NextResponse.json({ error: mediaVal.code, message: mediaVal.message }, { status: 400 });
    }

    const schedulePatch =
      parsed.scheduledFor !== undefined
        ? parsed.scheduledFor === null
          ? {
              scheduledAt: null as null,
              status: "DRAFT" as const,
              scheduledPublishMeta: null as null,
            }
          : {
              scheduledAt: new Date(parsed.scheduledFor),
              status: "SCHEDULED" as const,
              scheduledPublishMeta: mergeScheduledPublishMeta(parseScheduledPublishMeta(post.scheduledPublishMeta), {
                scheduledPublishSource: "manual_schedule",
              }),
            }
        : {};

    const nextScheduledIso = resultingScheduledIso;

    const materialChanged = socialPostMaterialFieldsChanged({
      prevCaption: post.caption ?? "",
      prevLinkUrl: post.linkUrl ?? null,
      prevSocialAccountId: post.socialAccountId ?? null,
      prevScheduledAtIso: iso(post.scheduledAt),
      prevAssetId: post.assetId ?? null,
      nextCaption: parsed.content !== undefined ? nextCaption : undefined,
      nextLinkUrl: parsed.linkUrl !== undefined ? nextLink : undefined,
      nextSocialAccountId: nextSocialAccountId !== undefined ? nextAccount : undefined,
      nextScheduledAtIso: parsed.scheduledFor !== undefined ? nextScheduledIso : undefined,
      nextAssetId: nextAssetIdField !== undefined ? nextAssetId : undefined,
    });

    const prevUtm = utmRecord(post.utmParams);
    const stored = parsePublishApprovalFromUtm(prevUtm).status;
    const actor = await resolvePublishApprovalActor({
      campaignOwnerUserId: access.campaign.userId,
      campaignReviewerRole: access.reviewerRole,
    });
    const nowIso = new Date().toISOString();

    const { utmParams: mergedUtm, approvalReset } = mergeUtmAfterSocialPostEdit({
      prevUtm,
      campaignPublishApprovalChainJson: access.campaign.publishApprovalChainJson,
      actor,
      nowIso,
      workerRequiresApproval,
      resubmitForApproval: Boolean(parsed.resubmitForApproval),
      storedApprovalStatus: stored,
      materialChanged,
    });

    await db
      .update(campaignPosts)
      .set({
        ...(parsed.content !== undefined ? { caption: nextCaption } : {}),
        ...(parsed.linkUrl !== undefined ? { linkUrl: nextLink } : {}),
        ...(nextSocialAccountId !== undefined ? { socialAccountId: nextAccount } : {}),
        ...(nextAssetIdField !== undefined ? { assetId: nextAssetId } : {}),
        ...schedulePatch,
        utmParams: mergedUtm,
        updatedAt: new Date(),
      })
      .where(eq(campaignPosts.id, id));

    const fresh = await db.select().from(campaignPosts).where(eq(campaignPosts.id, id)).limit(1);
    const row = fresh[0];

    const contentChanged = touchesContent && (post.caption ?? "") !== (row.caption ?? "");
    const scheduleChanged = touchesSchedule && iso(post.scheduledAt) !== iso(row.scheduledAt);
    const linkChanged = touchesLink && String(post.linkUrl ?? "") !== String(row.linkUrl ?? "");
    const accountChanged =
      nextSocialAccountId !== undefined && String(post.socialAccountId ?? "") !== String(row.socialAccountId ?? "");
    const assetChanged =
      nextAssetIdField !== undefined && String(post.assetId ?? "") !== String(row.assetId ?? "");

    const plannedPatchAudits = planSocialPostPatchAuditRows({
      postId: id,
      campaignId: row.campaignId,
      provider: row.platform,
      resubmitForApproval: Boolean(parsed.resubmitForApproval),
      approvalReset,
      materialChanged,
      previousApprovalStatus: stored,
      nextApprovalStatus: parsePublishApprovalFromUtm(utmRecord(row.utmParams)).status,
      actor: { userId: actor.userId, label: actor.label, role: actor.role },
      fieldDelta: {
        content: {
          changed: contentChanged,
          prevLength: (post.caption ?? "").length,
          nextLength: (row.caption ?? "").length,
        },
        schedule: {
          changed: scheduleChanged,
          prevIso: iso(post.scheduledAt),
          nextIso: iso(row.scheduledAt),
        },
        link: {
          changed: linkChanged,
          prevTruncated: truncateForAudit(post.linkUrl),
          nextTruncated: truncateForAudit(row.linkUrl),
        },
        account: {
          changed: accountChanged,
          prevAccountId: post.socialAccountId ?? null,
          nextAccountId: row.socialAccountId ?? null,
        },
        asset: {
          changed: assetChanged,
          prevAssetId: post.assetId ?? null,
          nextAssetId: row.assetId ?? null,
        },
      },
    });

    const patchAuditBaseMs = Date.now();
    for (let i = 0; i < plannedPatchAudits.length; i++) {
      const p = plannedPatchAudits[i]!;
      await db.insert(campaignAuditEvents).values({
        id: crypto.randomUUID(),
        userId: String(userId),
        postId: id,
        action: p.action,
        platform: row.platform,
        details: p.details,
        createdAt: new Date(patchAuditBaseMs + i),
      });
    }

    let socialAccountDisplayById: Record<string, string> = {};
    if (row.socialAccountId) {
      const acc = await db.select().from(socialAccounts).where(eq(socialAccounts.id, row.socialAccountId)).limit(1);
      if (acc[0]) {
        socialAccountDisplayById[acc[0].id] =
          acc[0].displayName?.trim() || defaultSocialAccountLabelForPlatform(acc[0].platform);
      }
    }

    const auditRows = await listSocialPostTimelineAuditRows(db, { postId: id });

    const creativeMapPatch = await fetchLinkedAssetCreativeTypeMap(db, [row.assetId]);
    const linkedCreativePatch = row.assetId ? creativeMapPatch[row.assetId] ?? null : null;

    const { plannerItem, approvalDetail, publishDetail, activityTimeline } = buildSocialPostDetailObservability({
      post: row,
      socialAccountDisplayById,
      auditRows,
      linkedAssetCreativeType: linkedCreativePatch,
    });

    return NextResponse.json({
      ok: true,
      post: mapCampaignPostRowToSocialGovernedPublic(row, { linkedAssetCreativeType: linkedCreativePatch }),
      plannerItem,
      approvalDetail,
      publishDetail,
      activityTimeline,
      activityTimelineOrder: "newest_first" as const,
      approvalReset,
      emittedAuditActions: plannedPatchAudits.map((p) => p.action),
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "VALIDATION_ERROR", details: e.flatten() }, { status: 400 });
    }
    console.error("[social/posts/[id] PATCH]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
