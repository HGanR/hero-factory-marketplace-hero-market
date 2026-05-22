import { NextRequest, NextResponse } from "next/server";
import { getExecutiveAdminUserId } from "@/lib/admin/get-executive-admin-user-id";
import { getDb } from "@/lib/db";
import { getSmartTrustFulfillmentOrderDetailForAdmin } from "@/lib/fulfillment/smart-trust-operations-service";

export const dynamic = "force-dynamic";

type RouteCtx = { params: Promise<{ id: string }> };

/** GET /api/admin/executive-agent/smart-trust/orders/:id */
export async function GET(req: NextRequest, ctx: RouteCtx) {
  const adminUserId = await getExecutiveAdminUserId(req);
  if (adminUserId == null) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: orderId } = await ctx.params;
  const db = await getDb();
  const result = await getSmartTrustFulfillmentOrderDetailForAdmin(db, { adminUserId, orderId });

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, code: result.code, message: result.message },
      { status: result.httpStatus }
    );
  }

  return NextResponse.json(result);
}
