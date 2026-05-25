import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAuthedUserId } from "@/lib/api/auth";
import { getDb } from "@/lib/db";
import { campaignAssets, campaignPosts, campaignReviewerAssignments, campaigns } from "@/lib/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { normalizeReviewerRole, userCanFinalizePublishApproval } from "@/lib/revenue-os/campaign-reviewer-role";
import { getCampaignReviewerAccess } from "@/lib/revenue-os/get-campaign-reviewer-access";
import { parseCampaignPublishApprovalChainJson } from "@/lib/revenue-os/publish-approval-chain";
import {
  getResolvedGovernanceCommercialTierLabel,
  governanceFeatureNotAvailableResponse,
  publishApprovalChainViolatesMultiStepEntitlement,
  resolveCampaignGovernanceEntitlements,
} from "@/lib/revenue-os/campaign-governance-entitlements";
import {
  governanceBadRequestResponse,
  governanceForbiddenCampaignSettingsResponse,
  governanceInternalErrorResponse,
  governanceNotFoundResponse,
  governanceUnauthorizedResponse,
  governanceValidationErrorResponse,
} from "@/lib/revenue-os/campaign-governance-http-response";
import {
  mergePublishApprovalReportScheduleOnPatch,
  parsePublishApprovalReportScheduleJson,
  PublishApprovalReportScheduleInputSchema,
  toPublishApprovalReportSchedulePublic,
} from "@/lib/revenue-os/publish-approval-report-schedule";

import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
import { resolveAssetDurableBadge } from "@/lib/revenue-os/bentley-campaign-asset-durable";
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const __rosGate = await enforceRevenueOsApiAccess(_req);
  if (__rosGate) return __rosGate;
  try {
    const userId = await getAuthedUserId();
    if (!userId) {
      return governanceUnauthorizedResponse();
    }

    const { id } = await params;
    if (!id) {
      return governanceBadRequestResponse("Missing campaign id.");
    }

    const db = await getDb();
    const access = await getCampaignReviewerAccess(db, userId, id);
    if (!access) {
      return governanceNotFoundResponse();
    }
    const cookieStore = await cookies();
    const adminSession = Boolean(cookieStore.get("admin-token")?.value?.trim());
    const viewerMayFinalizePublishApproval = userCanFinalizePublishApproval(access.reviewerRole, {
      adminSession,
    });
    const viewerCanManageReviewerAssignments =
      access.reviewerRole === "owner" || adminSession;

    const postRows = await db
      .select()
      .from(campaignPosts)
      .where(eq(campaignPosts.campaignId, id))
      .orderBy(campaignPosts.scheduledAt);

    const postAssetIds = [...new Set(postRows.map((p) => p.assetId).filter(Boolean) as string[])];
    const assetStorageById = new Map<string, string | null>();
    const assetCreativeById = new Map<string, string | null>();
    const assetMetaById = new Map<string, unknown>();
    if (postAssetIds.length > 0) {
      const assetRows = await db
        .select({
          id: campaignAssets.id,
          storageUrl: campaignAssets.storageUrl,
          creativeType: campaignAssets.creativeType,
          metadata: campaignAssets.metadata,
        })
        .from(campaignAssets)
        .where(and(eq(campaignAssets.campaignId, id), inArray(campaignAssets.id, postAssetIds)));
      for (const r of assetRows) {
        assetStorageById.set(r.id, r.storageUrl ?? null);
        assetCreativeById.set(r.id, r.creativeType ?? null);
        assetMetaById.set(r.id, r.metadata ?? null);
      }
    }

    const assignRows = await db
      .select({ role: campaignReviewerAssignments.role })
      .from(campaignReviewerAssignments)
      .where(eq(campaignReviewerAssignments.campaignId, id));

    const reviewerRoleCounts = { approver: 0, editor: 0, reviewer: 0 };
    for (const ar of assignRows) {
      const r = normalizeReviewerRole(ar.role);
      if (r === "approver") reviewerRoleCounts.approver += 1;
      else if (r === "editor") reviewerRoleCounts.editor += 1;
      else if (r === "reviewer") reviewerRoleCounts.reviewer += 1;
    }

    const campaign = access.campaign;
    const publishApprovalChain = parseCampaignPublishApprovalChainJson(campaign.publishApprovalChainJson);
    const publishApprovalReportSchedule = toPublishApprovalReportSchedulePublic(
      parsePublishApprovalReportScheduleJson(campaign.publishApprovalReportScheduleJson ?? null)
    );
    const ownerNum = Number(String(campaign.userId).trim());
    const ownerUserId = Number.isFinite(ownerNum) && ownerNum > 0 ? ownerNum : null;
    const governanceEntitlements = resolveCampaignGovernanceEntitlements({
      adminSession,
      clientId: campaign.clientId ?? null,
    });
    const governancePlanTierLabel = getResolvedGovernanceCommercialTierLabel({ adminSession });
    return NextResponse.json({
      id: campaign.id,
      name: campaign.name,
      objective: campaign.objective,
      status: campaign.status,
      startAt: campaign.startAt,
      endAt: campaign.endAt,
      createdAt: campaign.createdAt,
      updatedAt: campaign.updatedAt,
      publishApprovalChain,
      publishApprovalReportSchedule,
      viewerCampaignReviewerRole: access.reviewerRole,
      viewerMayFinalizePublishApproval,
      viewerCanManageReviewerAssignments,
      ownerUserId,
      reviewerRoleCounts,
      governanceEntitlements,
      governancePlanTierLabel,
      bentleyAutopilotPublish: Boolean(access.campaign.bentleyAutopilotPublish),
      posts: postRows.map((p) => ({
        id: p.id,
        platform: p.platform,
        assetId: p.assetId,
        /** Hosted URL for preview / client when the viewer already has campaign access (same scope as publish). */
        assetStorageUrl: p.assetId ? assetStorageById.get(p.assetId) ?? null : null,
        assetCreativeType: p.assetId ? assetCreativeById.get(p.assetId) ?? null : null,
        assetDurableBadge: p.assetId
          ? resolveAssetDurableBadge(assetStorageById.get(p.assetId) ?? null, assetMetaById.get(p.assetId))
          : null,
        scheduledAt: p.scheduledAt,
        status: p.status,
        caption: p.caption,
        bentleyDraftJson: p.bentleyDraftJson ?? null,
        hashtags: p.hashtags,
        linkUrl: p.linkUrl,
        utmParams: p.utmParams,
        scheduledPublishMeta: p.scheduledPublishMeta,
        platformPostId: p.platformPostId,
        errorMessage: p.errorMessage,
        /** When set, publish resolves this OAuth binding explicitly; otherwise worker picks latest account for platform. */
        socialAccountId: p.socialAccountId,
        postedAt: p.postedAt,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      })),
    });
  } catch (e) {
    console.error("[campaigns/[id]]", e);
    return governanceInternalErrorResponse();
  }
}

const PatchCampaignSchema = z.object({
  /** Owner-only: bypass scheduled publish approval gate for this campaign (worker). */
  bentleyAutopilotPublish: z.boolean().optional(),
  publishApprovalChain: z
    .object({
      steps: z.array(
        z.object({
          stepIndex: z.number().int().min(0),
          requiredReviewerRole: z.enum(["editor", "approver", "owner"]),
          label: z.string().max(120).optional(),
        })
      ),
    })
    .nullable()
    .optional(),
  publishApprovalReportSchedule: z.union([PublishApprovalReportScheduleInputSchema, z.null()]).optional(),
});

/**
 * PATCH /api/campaigns/:id
 * Owner (or admin session) — update publish approval chain configuration.
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
      return governanceUnauthorizedResponse();
    }

    const { id } = await params;
    if (!id) {
      return governanceBadRequestResponse("Missing campaign id.");
    }

    const body = await req.json();
    const parsed = PatchCampaignSchema.parse(body);
    if (
      parsed.publishApprovalChain === undefined &&
      parsed.publishApprovalReportSchedule === undefined &&
      parsed.bentleyAutopilotPublish === undefined
    ) {
      return governanceBadRequestResponse("No fields to update.", "NO_CHANGES");
    }

    const db = await getDb();
    const access = await getCampaignReviewerAccess(db, userId, id);
    if (!access) {
      return governanceNotFoundResponse();
    }

    const cookieStore = await cookies();
    const adminSession = Boolean(cookieStore.get("admin-token")?.value?.trim());
    if (access.reviewerRole !== "owner" && !adminSession) {
      return governanceForbiddenCampaignSettingsResponse();
    }

    const governanceEntitlements = resolveCampaignGovernanceEntitlements({
      adminSession,
      clientId: access.campaign.clientId ?? null,
    });

    let publishApprovalChainJson: ReturnType<typeof parseCampaignPublishApprovalChainJson> | null | undefined =
      undefined;
    if (parsed.publishApprovalChain !== undefined) {
      const normalized =
        parsed.publishApprovalChain == null
          ? null
          : parseCampaignPublishApprovalChainJson(parsed.publishApprovalChain);
      if (parsed.publishApprovalChain != null && normalized == null) {
        return governanceValidationErrorResponse("Invalid publishApprovalChain payload.");
      }
      if (
        normalized != null &&
        publishApprovalChainViolatesMultiStepEntitlement(normalized, governanceEntitlements)
      ) {
        return governanceFeatureNotAvailableResponse();
      }
      publishApprovalChainJson = normalized;
    }

    let publishApprovalReportScheduleJson: unknown = undefined;
    if (parsed.publishApprovalReportSchedule !== undefined) {
      if (parsed.publishApprovalReportSchedule !== null && !governanceEntitlements.scheduledReportDeliveryEnabled) {
        return governanceFeatureNotAvailableResponse();
      }
      if (parsed.publishApprovalReportSchedule === null) {
        publishApprovalReportScheduleJson = null;
      } else {
        const prev = parsePublishApprovalReportScheduleJson(access.campaign.publishApprovalReportScheduleJson ?? null);
        publishApprovalReportScheduleJson = mergePublishApprovalReportScheduleOnPatch({
          prev,
          input: parsed.publishApprovalReportSchedule,
        });
      }
    }

    await db
      .update(campaigns)
      .set({
        ...(publishApprovalChainJson !== undefined ? { publishApprovalChainJson } : {}),
        ...(publishApprovalReportScheduleJson !== undefined ? { publishApprovalReportScheduleJson } : {}),
        ...(parsed.bentleyAutopilotPublish !== undefined
          ? { bentleyAutopilotPublish: parsed.bentleyAutopilotPublish }
          : {}),
        updatedAt: new Date(),
      })
      .where(eq(campaigns.id, id));

    const fresh = await db.select().from(campaigns).where(eq(campaigns.id, id)).limit(1);
    const campRow = fresh[0];
    const outChain =
      publishApprovalChainJson !== undefined
        ? publishApprovalChainJson
        : parseCampaignPublishApprovalChainJson(campRow?.publishApprovalChainJson);
    const outSchedule = toPublishApprovalReportSchedulePublic(
      parsePublishApprovalReportScheduleJson(campRow?.publishApprovalReportScheduleJson ?? null)
    );

    return NextResponse.json({
      ok: true,
      ...(parsed.publishApprovalChain !== undefined ? { publishApprovalChain: outChain } : {}),
      ...(parsed.publishApprovalReportSchedule !== undefined ? { publishApprovalReportSchedule: outSchedule } : {}),
      ...(parsed.bentleyAutopilotPublish !== undefined
        ? { bentleyAutopilotPublish: parsed.bentleyAutopilotPublish }
        : {}),
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return governanceValidationErrorResponse("Invalid payload.", {
        fieldErrors: e.flatten().fieldErrors,
        formErrors: e.flatten().formErrors,
      });
    }
    console.error("[campaigns/[id] PATCH]", e);
    return governanceInternalErrorResponse();
  }
}
