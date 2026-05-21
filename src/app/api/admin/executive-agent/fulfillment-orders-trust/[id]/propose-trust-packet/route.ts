import { NextRequest, NextResponse } from "next/server";
import { getExecutiveAdminUserId } from "@/lib/admin/get-executive-admin-user-id";
import { getDb } from "@/lib/db";
import { proposeTrustPacketFromFulfillmentOrder } from "@/lib/fulfillment/fulfillment-trust-packet-routing";

export const dynamic = "force-dynamic";

type RouteCtx = { params: Promise<{ id: string }> };

/**
 * POST /api/admin/executive-agent/fulfillment-orders-trust/:id/propose-trust-packet
 * Routes a TRUST fulfillment order into createTrustFulfillmentPacket approval.
 * Internal legal-review note only — no trust apply, execution, or client delivery.
 */
export async function POST(req: NextRequest, ctx: RouteCtx) {
  const adminUserId = await getExecutiveAdminUserId(req);
  if (adminUserId == null) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: orderId } = await ctx.params;
  let body: unknown = {};
  try {
    const text = await req.text();
    if (text.trim()) body = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const db = await getDb();
  const result = await proposeTrustPacketFromFulfillmentOrder(db, {
    adminUserId,
    orderId,
    body,
  });

  if (!result.ok) {
    return NextResponse.json(
      {
        ok: false,
        code: result.code,
        message: result.message,
        ...(result.approvalId ? { approvalId: result.approvalId } : {}),
      },
      { status: result.httpStatus }
    );
  }

  return NextResponse.json({
    ok: true,
    approvalId: result.approvalId,
    orderId: result.orderId,
    pipelineStage: result.pipelineStage,
    proposedAction: "createTrustFulfillmentPacket",
    message: result.message,
  });
}
