import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";
import { and, asc, eq } from "drizzle-orm";
import { getAuthedUserId } from "@/lib/api/auth";
import { getDb } from "@/lib/db";
import { campaignReviewerAssignments, marketplaceUsers } from "@/lib/db/schema";
import {
  duplicateReviewerAssignmentResponse,
  invalidReviewerAssignmentResponse,
  mapAssignmentRowToApiItem,
  parseReviewerAssignmentPostBody,
} from "@/lib/revenue-os/campaign-reviewer-assignment-api";
import {
  recordReviewerAddedAuditAndNotify,
  safeReviewerAssignmentFollowUp,
} from "@/lib/revenue-os/campaign-reviewer-assignment-audit";
import { requireCampaignReviewerAssignmentManageAuth } from "@/lib/revenue-os/campaign-reviewer-assignment-manage";
import {
  governanceFeatureNotAvailableResponse,
  resolveCampaignGovernanceEntitlements,
} from "@/lib/revenue-os/campaign-governance-entitlements";
import {
  governanceBadRequestResponse,
  governanceInternalErrorResponse,
  governanceUnauthorizedResponse,
} from "@/lib/revenue-os/campaign-governance-http-response";

import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
/**
 * GET /api/campaigns/[id]/reviewers — { reviewers: ReviewerAssignmentApiItem[] }
 * POST — { ok: true, reviewer } or 409 duplicate
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const __rosGate = await enforceRevenueOsApiAccess(_req);
  if (__rosGate) return __rosGate;
  try {
    const userId = await getAuthedUserId();
    if (!userId) return governanceUnauthorizedResponse();

    const { id: campaignId } = await params;
    if (!campaignId) return governanceBadRequestResponse("Missing campaign id.");

    const db = await getDb();
    const cookieStore = await cookies();
    const adminSession = Boolean(cookieStore.get("admin-token")?.value?.trim());

    const auth = await requireCampaignReviewerAssignmentManageAuth(db, userId, campaignId, adminSession);
    if (!auth.ok) {
      return NextResponse.json(auth.body, { status: auth.status });
    }

    const ent = resolveCampaignGovernanceEntitlements({
      adminSession,
      clientId: auth.campaign.clientId ?? null,
    });
    if (!ent.reviewerAssignmentsEnabled) {
      return governanceFeatureNotAvailableResponse();
    }

    const assignRows = await db
      .select()
      .from(campaignReviewerAssignments)
      .where(eq(campaignReviewerAssignments.campaignId, campaignId))
      .orderBy(asc(campaignReviewerAssignments.createdAt));

    return NextResponse.json({
      reviewers: assignRows.map((r) => mapAssignmentRowToApiItem(r, campaignId)),
    });
  } catch (e) {
    console.error("[campaigns/[id]/reviewers GET]", e);
    return governanceInternalErrorResponse();
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const __rosGate = await enforceRevenueOsApiAccess(req);
  if (__rosGate) return __rosGate;
  try {
    const authedId = await getAuthedUserId();
    if (!authedId) return governanceUnauthorizedResponse();

    const { id: campaignId } = await params;
    if (!campaignId) return governanceBadRequestResponse("Missing campaign id.");

    const body = await req.json().catch(() => null);
    const parsed = parseReviewerAssignmentPostBody(body);
    if (!parsed.ok) {
      return NextResponse.json(invalidReviewerAssignmentResponse(parsed.message), { status: 400 });
    }

    const db = await getDb();
    const cookieStore = await cookies();
    const adminSession = Boolean(cookieStore.get("admin-token")?.value?.trim());

    const auth = await requireCampaignReviewerAssignmentManageAuth(db, authedId, campaignId, adminSession);
    if (!auth.ok) {
      return NextResponse.json(auth.body, { status: auth.status });
    }

    const ent = resolveCampaignGovernanceEntitlements({
      adminSession,
      clientId: auth.campaign.clientId ?? null,
    });
    if (!ent.reviewerAssignmentsEnabled) {
      return governanceFeatureNotAvailableResponse();
    }

    const ownerNum = Number(String(auth.campaign.userId).trim());
    if (Number.isFinite(ownerNum) && ownerNum === parsed.userId) {
      return NextResponse.json(
        invalidReviewerAssignmentResponse(
          "The campaign owner already has full access; do not add a reviewer row for that user."
        ),
        { status: 400 }
      );
    }

    const userRows = await db
      .select({ id: marketplaceUsers.id })
      .from(marketplaceUsers)
      .where(eq(marketplaceUsers.id, parsed.userId))
      .limit(1);
    if (!userRows[0]) {
      return NextResponse.json(
        invalidReviewerAssignmentResponse("No marketplace user exists for that user id."),
        { status: 400 }
      );
    }

    const uidStr = String(parsed.userId);
    const existing = await db
      .select()
      .from(campaignReviewerAssignments)
      .where(
        and(
          eq(campaignReviewerAssignments.campaignId, campaignId),
          eq(campaignReviewerAssignments.userId, uidStr)
        )
      )
      .limit(1);

    if (existing[0]) {
      return NextResponse.json(duplicateReviewerAssignmentResponse(), { status: 409 });
    }

    const newId = crypto.randomUUID();
    await db.insert(campaignReviewerAssignments).values({
      id: newId,
      campaignId,
      userId: uidStr,
      role: parsed.role,
    });

    const inserted = await db
      .select()
      .from(campaignReviewerAssignments)
      .where(eq(campaignReviewerAssignments.id, newId))
      .limit(1);
    const row = inserted[0];
    if (!row) {
      return governanceInternalErrorResponse();
    }

    void safeReviewerAssignmentFollowUp("reviewers-post-added", async () => {
      await recordReviewerAddedAuditAndNotify(db, {
        campaignId,
        campaignName: auth.campaign.name,
        clientId: auth.campaign.clientId ?? "",
        targetUserId: parsed.userId,
        actorUserId: authedId,
        role: parsed.role,
      });
    });

    return NextResponse.json({
      ok: true as const,
      reviewer: mapAssignmentRowToApiItem(row, campaignId),
    });
  } catch (e) {
    console.error("[campaigns/[id]/reviewers POST]", e);
    return governanceInternalErrorResponse();
  }
}
