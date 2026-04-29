import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAuthedUserId } from "@/lib/api/auth";
import { getDb } from "@/lib/db";
import { campaignPosts } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { computePublishApprovalAnalytics } from "@/lib/revenue-os/publish-approval-analytics";
import { getCampaignReviewerAccess } from "@/lib/revenue-os/get-campaign-reviewer-access";
import { parseCampaignPublishApprovalChainJson } from "@/lib/revenue-os/publish-approval-chain";
import {
  governanceFeatureNotAvailableResponse,
  resolveCampaignGovernanceEntitlements,
} from "@/lib/revenue-os/campaign-governance-entitlements";
import {
  governanceBadRequestResponse,
  governanceInternalErrorResponse,
  governanceNotFoundResponse,
  governanceUnauthorizedResponse,
} from "@/lib/revenue-os/campaign-governance-http-response";
import { readScheduledPublishRequireApprovalEnv } from "@/lib/revenue-os/publish-approval-gate";

import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
/**
 * GET /api/campaigns/:id/publish-approval-analytics
 * Owner or admin session — bottleneck summary + top stalled posts.
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
      return governanceUnauthorizedResponse();
    }

    const { id: campaignId } = await params;
    if (!campaignId) {
      return governanceBadRequestResponse("Missing campaign id.");
    }

    const db = await getDb();
    const access = await getCampaignReviewerAccess(db, userId, campaignId);
    if (!access) {
      return governanceNotFoundResponse();
    }

    const cookieStore = await cookies();
    const adminSession = Boolean(cookieStore.get("admin-token")?.value?.trim());
    const isOwner = access.reviewerRole === "owner";
    if (!isOwner && !adminSession) {
      return NextResponse.json(
        {
          error: "FORBIDDEN_ANALYTICS",
          message: "Only the campaign owner or an admin can view publish approval analytics.",
        },
        { status: 403 }
      );
    }

    const ent = resolveCampaignGovernanceEntitlements({
      adminSession,
      clientId: access.campaign.clientId ?? null,
    });
    if (!ent.approvalAnalyticsEnabled) {
      return governanceFeatureNotAvailableResponse();
    }

    const rawWorker = req.nextUrl.searchParams.get("workerRequiresApproval");
    const workerRequiresApproval =
      rawWorker === "false" ? false : rawWorker === "true" ? true : readScheduledPublishRequireApprovalEnv();

    const stalledLimitRaw = req.nextUrl.searchParams.get("stalledLimit");
    const stalledLimitParsed = stalledLimitRaw ? parseInt(stalledLimitRaw, 10) : NaN;
    const stalledPostsLimit = Number.isFinite(stalledLimitParsed)
      ? stalledLimitParsed
      : undefined;

    const postRows = await db
      .select({ id: campaignPosts.id, utmParams: campaignPosts.utmParams })
      .from(campaignPosts)
      .where(eq(campaignPosts.campaignId, campaignId));

    const chain = parseCampaignPublishApprovalChainJson(access.campaign.publishApprovalChainJson ?? null);

    const result = computePublishApprovalAnalytics({
      posts: postRows,
      publishApprovalChain: chain,
      workerRequiresApproval,
      stalledPostsLimit,
    });

    return NextResponse.json({
      summary: result.summary,
      stalledPosts: result.stalledPosts,
    });
  } catch (e) {
    console.error("[campaigns/publish-approval-analytics]", e);
    return governanceInternalErrorResponse();
  }
}
