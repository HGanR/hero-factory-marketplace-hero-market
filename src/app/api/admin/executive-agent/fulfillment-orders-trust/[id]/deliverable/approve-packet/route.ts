import { NextRequest, NextResponse } from "next/server";
import { getExecutiveAdminUserId } from "@/lib/admin/get-executive-admin-user-id";
import { getDb } from "@/lib/db";
import { approveTrustDeliverableForRelease } from "@/lib/fulfillment/fulfillment-trust-deliverable-draft";

export const dynamic = "force-dynamic";

type RouteCtx = { params: Promise<{ id: string }> };

/**
 * POST /api/admin/executive-agent/fulfillment-orders-trust/:id/deliverable/approve-packet
 * Owner approves trust packet for internal release — no trust apply or client delivery.
 */
export async function POST(req: NextRequest, ctx: RouteCtx) {
  const adminUserId = await getExecutiveAdminUserId(req);
  if (adminUserId == null) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: orderId } = await ctx.params;
  const db = await getDb();
  const result = await approveTrustDeliverableForRelease(db, { orderId, adminUserId });

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
