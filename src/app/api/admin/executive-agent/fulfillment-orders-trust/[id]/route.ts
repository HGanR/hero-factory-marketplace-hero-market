import { NextRequest, NextResponse } from "next/server";
import { getExecutiveAdminUserId } from "@/lib/admin/get-executive-admin-user-id";
import { getDb } from "@/lib/db";
import { getTrustFulfillmentOrderDetailForAdmin } from "@/lib/fulfillment/fulfillment-trust-order-detail-service";

export const dynamic = "force-dynamic";

type RouteCtx = { params: Promise<{ id: string }> };

/**
 * GET /api/admin/executive-agent/fulfillment-orders-trust/:id
 * TRUST order detail, timeline, and next recommended desk action.
 */
export async function GET(req: NextRequest, ctx: RouteCtx) {
  const adminUserId = await getExecutiveAdminUserId(req);
  if (adminUserId == null) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: orderId } = await ctx.params;
  const db = await getDb();
  const result = await getTrustFulfillmentOrderDetailForAdmin(db, { adminUserId, orderId });

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, code: result.code, message: result.message },
      { status: result.httpStatus }
    );
  }

  return NextResponse.json(result);
}
