import { NextRequest, NextResponse } from "next/server";
import { getExecutiveAdminUserId } from "@/lib/admin/get-executive-admin-user-id";
import { getDb } from "@/lib/db";
import { listWebsiteFulfillmentQueueForAdmin } from "@/lib/fulfillment/fulfillment-queue-service";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/executive-agent/fulfillment-queue
 * Read-only WEBSITE / Site Builder fulfillment queue for the signed-in executive admin.
 */
export async function GET(req: NextRequest) {
  const adminUserId = await getExecutiveAdminUserId(req);
  if (adminUserId == null) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limitRaw = req.nextUrl.searchParams.get("limit");
  const limit = limitRaw ? Number.parseInt(limitRaw, 10) : 50;
  const stage = req.nextUrl.searchParams.get("stage");
  const approval = req.nextUrl.searchParams.get("approval");

  const db = await getDb();
  const result = await listWebsiteFulfillmentQueueForAdmin(db, {
    adminUserId,
    limit: Number.isFinite(limit) ? limit : 50,
    stage,
    approval,
  });

  return NextResponse.json(result);
}
