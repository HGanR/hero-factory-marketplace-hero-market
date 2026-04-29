import { NextRequest, NextResponse } from "next/server";
import { desc, eq, and, inArray } from "drizzle-orm";
import { getAuthedUserId } from "@/lib/api/auth";
import { getDb } from "@/lib/db";
import { campaignAuditEvents } from "@/lib/db/schema";
import {
  PUBLISH_APPROVAL_AUDIT_ACTIONS,
  toPublishApprovalAuditRecentApiEvent,
} from "@/lib/revenue-os/publish-approval-audit";
import { parseApprovalAuditRecentQueryParams } from "@/lib/revenue-os/approval-audit-recent-query";
import {
  governanceInternalErrorResponse,
  governanceUnauthorizedResponse,
} from "@/lib/revenue-os/campaign-governance-http-response";

import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
/**
 * GET /api/revenue-os/approval-audit-recent?limit=5&postId=&platform=
 * Publish-approval lifecycle rows from `campaign_audit_events` (debug / governance UI).
 */
export async function GET(req: NextRequest) {
  const __rosGate = await enforceRevenueOsApiAccess(req);
  if (__rosGate) return __rosGate;
  try {
    const userId = await getAuthedUserId();
    if (!userId) {
      return governanceUnauthorizedResponse();
    }

    const { limit, postId: postIdFilter, platform: platformFilter } = parseApprovalAuditRecentQueryParams(
      new URL(req.url).searchParams
    );

    const conditions = [
      eq(campaignAuditEvents.userId, String(userId)),
      inArray(campaignAuditEvents.action, PUBLISH_APPROVAL_AUDIT_ACTIONS),
    ];
    if (postIdFilter) {
      conditions.push(eq(campaignAuditEvents.postId, postIdFilter));
    }
    if (platformFilter) {
      conditions.push(eq(campaignAuditEvents.platform, platformFilter));
    }

    const db = await getDb();
    const rows = await db
      .select({
        id: campaignAuditEvents.id,
        postId: campaignAuditEvents.postId,
        action: campaignAuditEvents.action,
        platform: campaignAuditEvents.platform,
        details: campaignAuditEvents.details,
        createdAt: campaignAuditEvents.createdAt,
      })
      .from(campaignAuditEvents)
      .where(and(...conditions))
      .orderBy(desc(campaignAuditEvents.createdAt))
      .limit(limit);

    return NextResponse.json({
      events: rows.map((r) =>
        toPublishApprovalAuditRecentApiEvent({
          id: r.id,
          postId: r.postId ?? null,
          action: r.action,
          platform: r.platform ?? null,
          details: r.details,
          createdAt: r.createdAt,
        })
      ),
    });
  } catch (e) {
    console.error("[revenue-os/approval-audit-recent]", e);
    return governanceInternalErrorResponse();
  }
}
