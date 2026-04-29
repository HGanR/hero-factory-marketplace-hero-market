import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { desc, eq } from "drizzle-orm";
import { getAuthedUserId } from "@/lib/api/auth";
import { getDb } from "@/lib/db";
import { campaignReviewerAssignmentAuditEvents } from "@/lib/db/schema";
import {
  mapReviewerAssignmentAuditRowToApiItem,
  parseReviewerAssignmentAuditLimit,
} from "@/lib/revenue-os/campaign-reviewer-assignment-audit";
import { requireCampaignReviewerAssignmentManageAuth } from "@/lib/revenue-os/campaign-reviewer-assignment-manage";
import {
  governanceBadRequestResponse,
  governanceInternalErrorResponse,
  governanceUnauthorizedResponse,
} from "@/lib/revenue-os/campaign-governance-http-response";

import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
/**
 * GET /api/campaigns/[id]/reviewer-audit?limit=10 — recent assignment audit (owner/admin; debug / tooling).
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const __rosGate = await enforceRevenueOsApiAccess(req);
  if (__rosGate) return __rosGate;
  try {
    const userId = await getAuthedUserId();
    if (!userId) return governanceUnauthorizedResponse();

    const { id: campaignId } = await params;
    if (!campaignId) return governanceBadRequestResponse("Missing campaign id.");

    const limit = parseReviewerAssignmentAuditLimit(req.nextUrl.searchParams.get("limit"));

    const db = await getDb();
    const cookieStore = await cookies();
    const adminSession = Boolean(cookieStore.get("admin-token")?.value?.trim());

    const auth = await requireCampaignReviewerAssignmentManageAuth(db, userId, campaignId, adminSession);
    if (!auth.ok) {
      return NextResponse.json(auth.body, { status: auth.status });
    }

    const rows = await db
      .select()
      .from(campaignReviewerAssignmentAuditEvents)
      .where(eq(campaignReviewerAssignmentAuditEvents.campaignId, campaignId))
      .orderBy(desc(campaignReviewerAssignmentAuditEvents.createdAt))
      .limit(limit);

    return NextResponse.json({
      events: rows.map(mapReviewerAssignmentAuditRowToApiItem),
    });
  } catch (e) {
    console.error("[campaigns/[id]/reviewer-audit]", e);
    return governanceInternalErrorResponse();
  }
}
