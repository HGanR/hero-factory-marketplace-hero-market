import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthedUserId } from "@/lib/api/auth";
import { getDb } from "@/lib/db";
import { campaignPosts, campaignReviewerAssignments } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getCampaignReviewerAccess } from "@/lib/revenue-os/get-campaign-reviewer-access";
import {
  governanceBadRequestResponse,
  governanceInternalErrorResponse,
  governanceNotFoundResponse,
  governanceUnauthorizedResponse,
} from "@/lib/revenue-os/campaign-governance-http-response";
import { runCampaignPublishApprovalSlaScan } from "@/lib/revenue-os/publish-approval-sla-scan";

import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
const BodySchema = z.object({
  /** Match publish workflow panel / worker gate so effective pending matches list UI. */
  workerRequiresApproval: z.boolean().optional(),
});

/**
 * POST /api/campaigns/:id/publish-approval-sla-scan
 * Lightweight SLA reminder pass (called from workflow refresh; idempotent per post per step via UTM).
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
      return governanceUnauthorizedResponse();
    }

    const { id: campaignId } = await params;
    if (!campaignId) {
      return governanceBadRequestResponse("Missing campaign id.");
    }

    let workerRequiresApproval = true;
    try {
      const j = (await req.json()) as unknown;
      const parsed = BodySchema.safeParse(j);
      if (parsed.success && parsed.data.workerRequiresApproval != null) {
        workerRequiresApproval = parsed.data.workerRequiresApproval;
      }
    } catch {
      /* empty body */
    }

    const db = await getDb();
    const access = await getCampaignReviewerAccess(db, userId, campaignId);
    if (!access) {
      return governanceNotFoundResponse();
    }

    const assignRows = await db
      .select({ userId: campaignReviewerAssignments.userId, role: campaignReviewerAssignments.role })
      .from(campaignReviewerAssignments)
      .where(eq(campaignReviewerAssignments.campaignId, campaignId));

    const postRows = await db
      .select({ id: campaignPosts.id, utmParams: campaignPosts.utmParams })
      .from(campaignPosts)
      .where(eq(campaignPosts.campaignId, campaignId));

    const camp = access.campaign;
    const result = await runCampaignPublishApprovalSlaScan(db, {
      campaignId,
      campaignName: camp.name ?? "",
      clientId: camp.clientId ?? "",
      ownerUserId: camp.userId,
      publishApprovalChainJson: camp.publishApprovalChainJson,
      posts: postRows,
      workerRequiresApproval,
      assignmentRows: assignRows,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    console.error("[campaigns/publish-approval-sla-scan]", e);
    return governanceInternalErrorResponse();
  }
}
