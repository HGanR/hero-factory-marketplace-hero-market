import { NextRequest, NextResponse } from "next/server";
import { getExecutiveAdminUserId } from "@/lib/admin/get-executive-admin-user-id";
import { getDb } from "@/lib/db";
import { revokeClientDeliveryLinks } from "@/lib/fulfillment/fulfillment-client-delivery-service";

export const dynamic = "force-dynamic";

type RouteCtx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: RouteCtx) {
  const adminUserId = await getExecutiveAdminUserId(req);
  if (adminUserId == null) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: orderId } = await ctx.params;
  const db = await getDb();
  const result = await revokeClientDeliveryLinks(db, { orderId, adminUserId });

  if (!result.ok) {
    return NextResponse.json({ ok: false, message: result.message }, { status: result.httpStatus });
  }

  return NextResponse.json({ ok: true, revoked: result.revoked });
}
