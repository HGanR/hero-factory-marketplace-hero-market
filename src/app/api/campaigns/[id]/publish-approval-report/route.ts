import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { getAuthedUserId } from "@/lib/api/auth";
import { getDb } from "@/lib/db";
import { campaignPosts } from "@/lib/db/schema";
import { getCampaignReviewerAccess } from "@/lib/revenue-os/get-campaign-reviewer-access";
import { readScheduledPublishRequireApprovalEnv } from "@/lib/revenue-os/publish-approval-gate";
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
import {
  buildPublishApprovalComplianceReportCsv,
  composePublishApprovalComplianceReport,
  fetchPublishApprovalAuditTailForCampaign,
  fetchReviewerAssignmentAuditTailForCampaign,
  parsePublishApprovalReportQueryParams,
  type PublishApprovalComplianceAuditRow,
  type ReviewerAssignmentComplianceAuditRow,
} from "@/lib/revenue-os/publish-approval-compliance-report";

import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
/**
 * GET /api/campaigns/:id/publish-approval-report
 * Owner or admin — compliance export (JSON default; `format=csv` supported).
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
          error: "FORBIDDEN_REPORT",
          message: "Only the campaign owner or an admin can export the publish approval report.",
        },
        { status: 403 }
      );
    }

    const ent = resolveCampaignGovernanceEntitlements({
      adminSession,
      clientId: access.campaign.clientId ?? null,
    });
    if (!ent.complianceReportExportEnabled) {
      return governanceFeatureNotAvailableResponse();
    }

    const q = parsePublishApprovalReportQueryParams(req.nextUrl.searchParams);

    const rawWorker = req.nextUrl.searchParams.get("workerRequiresApproval");
    const workerRequiresApproval =
      rawWorker === "false" ? false : rawWorker === "true" ? true : readScheduledPublishRequireApprovalEnv();

    const postRows = await db
      .select({ id: campaignPosts.id, utmParams: campaignPosts.utmParams })
      .from(campaignPosts)
      .where(eq(campaignPosts.campaignId, campaignId));

    const camp = access.campaign;
    let publishTail: PublishApprovalComplianceAuditRow[] | undefined;
    let reviewerTail: ReviewerAssignmentComplianceAuditRow[] | undefined;
    if (q.includeAuditTail) {
      [publishTail, reviewerTail] = await Promise.all([
        fetchPublishApprovalAuditTailForCampaign(db, { campaignId, limit: q.auditLimit }),
        fetchReviewerAssignmentAuditTailForCampaign(db, { campaignId, limit: q.auditLimit }),
      ]);
    }

    const report = composePublishApprovalComplianceReport({
      generatedAt: new Date(),
      campaignId,
      campaignName: camp.name ?? "",
      publishApprovalChainJson: camp.publishApprovalChainJson ?? null,
      workerRequiresApproval,
      postRows,
      includeCurrentState: q.includeCurrentState,
      includeAuditTail: q.includeAuditTail,
      publishApprovalAuditTail: publishTail,
      reviewerAssignmentAuditTail: reviewerTail,
    });

    if (q.format === "csv") {
      const body = buildPublishApprovalComplianceReportCsv(report);
      const safeName = (camp.name ?? "campaign").replace(/[^\w\-]+/g, "_").slice(0, 80);
      return new NextResponse(body, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="publish-approval-report-${safeName}-${campaignId.slice(0, 8)}.csv"`,
        },
      });
    }

    return NextResponse.json(report);
  } catch (e) {
    console.error("[campaigns/publish-approval-report]", e);
    return governanceInternalErrorResponse();
  }
}
