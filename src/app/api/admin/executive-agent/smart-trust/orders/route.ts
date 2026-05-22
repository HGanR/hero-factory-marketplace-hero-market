import { NextRequest, NextResponse } from "next/server";
import { getExecutiveAdminUserId } from "@/lib/admin/get-executive-admin-user-id";
import { getDb } from "@/lib/db";
import { listSmartTrustFulfillmentQueueForAdmin } from "@/lib/fulfillment/smart-trust-operations-service";

export const dynamic = "force-dynamic";

/** GET /api/admin/executive-agent/smart-trust/orders — SMART_TRUST governance queue (governed). */
export async function GET(req: NextRequest) {
  const adminUserId = await getExecutiveAdminUserId(req);
  if (adminUserId == null) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const limit = Number(searchParams.get("limit") ?? "50");
  const stage = searchParams.get("stage");
  const approval = searchParams.get("approval");

  const db = await getDb();
  const result = await listSmartTrustFulfillmentQueueForAdmin(db, {
    adminUserId,
    limit: Number.isFinite(limit) ? limit : 50,
    stage,
    approval,
  });

  return NextResponse.json(result);
}
