import { NextRequest, NextResponse } from "next/server";
import { getExecutiveAdminUserId } from "@/lib/admin/get-executive-admin-user-id";
import { getDb } from "@/lib/db";
import { approveDeliverableDraftForRelease } from "@/lib/fulfillment/fulfillment-deliverable-draft";

export const dynamic = "force-dynamic";

type RouteCtx = { params: Promise<{ id: string }> };

/**
 * POST …/fulfillment-orders/:id/deliverable/approve-draft
 * Owner marks draft approved_for_release — no email, deploy, or client send.
 */
export async function POST(req: NextRequest, ctx: RouteCtx) {
  const adminUserId = await getExecutiveAdminUserId(req);
  if (adminUserId == null) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: orderId } = await ctx.params;
  const db = await getDb();
  const result = await approveDeliverableDraftForRelease(db, { orderId, adminUserId });

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, code: result.code, message: result.message },
      { status: result.httpStatus }
    );
  }

  return NextResponse.json({
    ok: true,
    pipelineStage: result.pipelineStage,
    ownerReviewStatus: result.ownerReviewStatus,
    message: result.message,
  });
}
