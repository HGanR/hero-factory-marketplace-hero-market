import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { and, desc, eq } from "drizzle-orm";
import { getAuthedUserId } from "@/lib/api/auth";
import { getDb } from "@/lib/db";
import { campaignAuditEvents, campaignPosts, campaignReviewerAssignments } from "@/lib/db/schema";
import { computePublishApprovalReviewerAnalytics } from "@/lib/revenue-os/publish-approval-reviewer-analytics";
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
 * GET /api/campaigns/:id/publish-approval-reviewer-analytics
 * Owner or admin — reviewer workload + role-level aggregates.
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
          error: "FORBIDDEN_REVIEWER_ANALYTICS",
          message: "Only the campaign owner or an admin can view publish approval reviewer analytics.",
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

    const auditLimitRaw = req.nextUrl.searchParams.get("auditLimit");
    const auditLimitParsed = auditLimitRaw ? parseInt(auditLimitRaw, 10) : NaN;
    const recentAuditLimit = Number.isFinite(auditLimitParsed)
      ? Math.min(100, Math.max(1, auditLimitParsed))
      : 50;

    const postRows = await db
      .select({ id: campaignPosts.id, utmParams: campaignPosts.utmParams })
      .from(campaignPosts)
      .where(eq(campaignPosts.campaignId, campaignId));

    const assignRows = await db
      .select({ userId: campaignReviewerAssignments.userId, role: campaignReviewerAssignments.role })
      .from(campaignReviewerAssignments)
      .where(eq(campaignReviewerAssignments.campaignId, campaignId));

    const approvalAuditRows = await db
      .select({ details: campaignAuditEvents.details })
      .from(campaignAuditEvents)
      .innerJoin(campaignPosts, eq(campaignAuditEvents.postId, campaignPosts.id))
      .where(
        and(
          eq(campaignPosts.campaignId, campaignId),
          eq(campaignAuditEvents.action, "publish_approval_approved")
        )
      )
      .orderBy(desc(campaignAuditEvents.createdAt))
      .limit(recentAuditLimit);

    const chain = parseCampaignPublishApprovalChainJson(access.campaign.publishApprovalChainJson ?? null);
    const camp = access.campaign;

    const result = computePublishApprovalReviewerAnalytics({
      posts: postRows,
      publishApprovalChain: chain,
      workerRequiresApproval,
      ownerUserId: camp.userId,
      assignmentRows: assignRows,
      recentApprovalAuditRows: approvalAuditRows,
      recentApprovalAuditMax: recentAuditLimit,
    });

    return NextResponse.json(result);
  } catch (e) {
    console.error("[campaigns/publish-approval-reviewer-analytics]", e);
    return governanceInternalErrorResponse();
  }
}
