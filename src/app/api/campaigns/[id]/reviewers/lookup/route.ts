import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { and, eq, like, or, sql } from "drizzle-orm";
import { getAuthedUserId } from "@/lib/api/auth";
import { getDb } from "@/lib/db";
import { marketplaceUsers } from "@/lib/db/schema";
import {
  mapMarketplaceRowToReviewerLookupCandidate,
  normalizeReviewerLookupQuery,
  parseReviewerLookupLimit,
} from "@/lib/revenue-os/campaign-reviewer-assignment-lookup";
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
 * GET /api/campaigns/[id]/reviewers/lookup?q=&limit=
 * Owner/admin only. Bounded candidates for assignment UX (approved + active users).
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const __rosGate = await enforceRevenueOsApiAccess(req);
  if (__rosGate) return __rosGate;
  try {
    const authedId = await getAuthedUserId();
    if (!authedId) return governanceUnauthorizedResponse();

    const { id: campaignId } = await params;
    if (!campaignId) return governanceBadRequestResponse("Missing campaign id.");

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

    const q = normalizeReviewerLookupQuery(req.nextUrl.searchParams.get("q"));
    if (!q) {
      return NextResponse.json({ candidates: [] as ReturnType<typeof mapMarketplaceRowToReviewerLookupCandidate>[] });
    }

    const limit = parseReviewerLookupLimit(req.nextUrl.searchParams.get("limit"));

    const pattern = `%${q}%`;
    const idMatch = /^\d+$/.test(q);
    const idPrefixPattern = `${q}%`;

    const searchClause = idMatch
      ? or(
          like(marketplaceUsers.email, pattern),
          like(marketplaceUsers.username, pattern),
          sql`CAST(${marketplaceUsers.id} AS CHAR) LIKE ${idPrefixPattern}`
        )
      : or(like(marketplaceUsers.email, pattern), like(marketplaceUsers.username, pattern));

    const rows = await db
      .select({
        id: marketplaceUsers.id,
        username: marketplaceUsers.username,
        email: marketplaceUsers.email,
      })
      .from(marketplaceUsers)
      .where(
        and(eq(marketplaceUsers.isApproved, true), eq(marketplaceUsers.isActive, true), searchClause)
      )
      .limit(limit);

    return NextResponse.json({
      candidates: rows.map(mapMarketplaceRowToReviewerLookupCandidate),
    });
  } catch (e) {
    console.error("[campaigns/.../reviewers/lookup GET]", e);
    return governanceInternalErrorResponse();
  }
}
