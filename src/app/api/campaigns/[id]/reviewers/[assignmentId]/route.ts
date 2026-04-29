import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { and, eq } from "drizzle-orm";
import { getAuthedUserId } from "@/lib/api/auth";
import { getDb } from "@/lib/db";
import { campaignReviewerAssignments } from "@/lib/db/schema";
import {
  invalidReviewerAssignmentResponse,
  mapAssignmentRowToApiItem,
  parseReviewerAssignmentPatchBody,
} from "@/lib/revenue-os/campaign-reviewer-assignment-api";
import {
  recordReviewerRemovedAuditAndNotify,
  recordReviewerRoleChangedAuditAndNotify,
  safeReviewerAssignmentFollowUp,
} from "@/lib/revenue-os/campaign-reviewer-assignment-audit";
import { normalizeReviewerRole } from "@/lib/revenue-os/campaign-reviewer-role";
import { requireCampaignReviewerAssignmentManageAuth } from "@/lib/revenue-os/campaign-reviewer-assignment-manage";
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

import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
async function getAssignmentForCampaign(
  db: Awaited<ReturnType<typeof getDb>>,
  campaignId: string,
  assignmentId: string
) {
  const rows = await db
    .select()
    .from(campaignReviewerAssignments)
    .where(
      and(
        eq(campaignReviewerAssignments.id, assignmentId),
        eq(campaignReviewerAssignments.campaignId, campaignId)
      )
    )
    .limit(1);
  return rows[0] ?? null;
}

/**
 * PATCH /api/campaigns/[id]/reviewers/[assignmentId] — role only
 * DELETE — { ok: true, id }
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; assignmentId: string }> }
) {
  const __rosGate = await enforceRevenueOsApiAccess(req);
  if (__rosGate) return __rosGate;
  try {
    const authedId = await getAuthedUserId();
    if (!authedId) return governanceUnauthorizedResponse();

    const { id: campaignId, assignmentId } = await params;
    if (!campaignId || !assignmentId) {
      return governanceBadRequestResponse("Missing campaign id or assignment id.");
    }

    const body = await req.json().catch(() => null);
    const parsed = parseReviewerAssignmentPatchBody(body);
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

    const existing = await getAssignmentForCampaign(db, campaignId, assignmentId);
    if (!existing) {
      return governanceNotFoundResponse("Assignment not found for this campaign.");
    }

    if (normalizeReviewerRole(existing.role) === normalizeReviewerRole(parsed.role)) {
      return NextResponse.json({
        ok: true as const,
        reviewer: mapAssignmentRowToApiItem(existing, campaignId),
      });
    }

    await db
      .update(campaignReviewerAssignments)
      .set({ role: parsed.role })
      .where(eq(campaignReviewerAssignments.id, assignmentId));

    const row = await getAssignmentForCampaign(db, campaignId, assignmentId);
    if (!row) {
      return governanceInternalErrorResponse();
    }

    const targetUserId = Number(String(existing.userId).trim());
    void safeReviewerAssignmentFollowUp("reviewers-patch-role", async () => {
      if (!Number.isFinite(targetUserId) || targetUserId <= 0) return;
      await recordReviewerRoleChangedAuditAndNotify(db, {
        campaignId,
        campaignName: auth.campaign.name,
        clientId: auth.campaign.clientId ?? "",
        targetUserId,
        actorUserId: authedId,
        previousRole: existing.role,
        nextRole: parsed.role,
      });
    });

    return NextResponse.json({
      ok: true as const,
      reviewer: mapAssignmentRowToApiItem(row, campaignId),
    });
  } catch (e) {
    console.error("[campaigns/.../reviewers/PATCH]", e);
    return governanceInternalErrorResponse();
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; assignmentId: string }> }
) {
  const __rosGate = await enforceRevenueOsApiAccess(_req);
  if (__rosGate) return __rosGate;
  try {
    const authedId = await getAuthedUserId();
    if (!authedId) return governanceUnauthorizedResponse();

    const { id: campaignId, assignmentId } = await params;
    if (!campaignId || !assignmentId) {
      return governanceBadRequestResponse("Missing campaign id or assignment id.");
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

    const existing = await getAssignmentForCampaign(db, campaignId, assignmentId);
    if (!existing) {
      return governanceNotFoundResponse("Assignment not found for this campaign.");
    }

    const targetUserId = Number(String(existing.userId).trim());

    await db.delete(campaignReviewerAssignments).where(eq(campaignReviewerAssignments.id, assignmentId));

    void safeReviewerAssignmentFollowUp("reviewers-delete", async () => {
      if (!Number.isFinite(targetUserId) || targetUserId <= 0) return;
      await recordReviewerRemovedAuditAndNotify(db, {
        campaignId,
        campaignName: auth.campaign.name,
        clientId: auth.campaign.clientId ?? "",
        targetUserId,
        actorUserId: authedId,
        previousRole: existing.role,
      });
    });

    return NextResponse.json({ ok: true as const, id: assignmentId });
  } catch (e) {
    console.error("[campaigns/.../reviewers/DELETE]", e);
    return governanceInternalErrorResponse();
  }
}
