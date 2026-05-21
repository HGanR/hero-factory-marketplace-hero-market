import { NextRequest, NextResponse } from "next/server";
import { getExecutiveAdminUserId } from "@/lib/admin/get-executive-admin-user-id";
import { getDb } from "@/lib/db";
import { listTrustFulfillmentQueueForAdmin } from "@/lib/fulfillment/fulfillment-trust-queue-service";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/executive-agent/fulfillment-queue-trust
 * TRUST / Trust Records fulfillment queue (isolated from WEBSITE queue).
 */
export async function GET(req: NextRequest) {
  const adminUserId = await getExecutiveAdminUserId(req);
  if (adminUserId == null) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = req.nextUrl;
  const limit = Number(url.searchParams.get("limit") ?? "50");
  const stage = url.searchParams.get("stage");
  const approval = url.searchParams.get("approval");

  const db = await getDb();
  const result = await listTrustFulfillmentQueueForAdmin(db, {
    adminUserId,
    limit: Number.isFinite(limit) ? limit : 50,
    stage,
    approval,
  });

  return NextResponse.json(result);
}
