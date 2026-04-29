import { NextRequest, NextResponse } from "next/server";
import { getAuthedUserId } from "@/lib/api/auth";
import { getDb } from "@/lib/db";
import { campaignExternalSocialReviewTokens } from "@/lib/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
import { getCampaignReviewerAccess } from "@/lib/revenue-os/get-campaign-reviewer-access";
import {
  buildExternalReviewLinkRevokedDetails,
  EXTERNAL_REVIEW_LINK_REVOKED_ACTION,
  insertExternalReviewLinkAuditEvent,
  resolveExternalReviewAuditPostId,
} from "@/lib/social/external-social-review-audit";
import { parseExternalReviewAllowedRolesJson } from "@/lib/social/external-social-review-token";

/**
 * POST /api/social/external-review-tokens/:id/revoke
 * Optional JSON body: { contextPostId?: string } — attaches audit to that post’s timeline when valid for the campaign.
 */
export async function POST(
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

    let contextPostId: string | undefined;
    try {
      const body = await req.json();
      if (body && typeof body === "object" && typeof (body as { contextPostId?: string }).contextPostId === "string") {
        contextPostId = (body as { contextPostId: string }).contextPostId.trim();
      }
    } catch {
      contextPostId = undefined;
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "MISSING_ID" }, { status: 400 });
    }

    const db = await getDb();
    const rows = await db
      .select()
      .from(campaignExternalSocialReviewTokens)
      .where(and(eq(campaignExternalSocialReviewTokens.id, id), isNull(campaignExternalSocialReviewTokens.revokedAt)))
      .limit(1);
    const row = rows[0];
    if (!row) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }

    const access = await getCampaignReviewerAccess(db, userId, row.campaignId);
    if (!access) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }

    await db
      .update(campaignExternalSocialReviewTokens)
      .set({ revokedAt: new Date(), updatedAt: new Date() })
      .where(eq(campaignExternalSocialReviewTokens.id, id));

    const roles = parseExternalReviewAllowedRolesJson(row.allowedRolesJson);
    const auditPostId = await resolveExternalReviewAuditPostId(db, row.campaignId, contextPostId);
    await insertExternalReviewLinkAuditEvent({
      db,
      userId,
      postId: auditPostId,
      action: EXTERNAL_REVIEW_LINK_REVOKED_ACTION,
      details: buildExternalReviewLinkRevokedDetails({
        tokenId: id,
        label: row.label,
        allowedRoles: roles,
      }),
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[social/external-review-tokens/[id]/revoke POST]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
