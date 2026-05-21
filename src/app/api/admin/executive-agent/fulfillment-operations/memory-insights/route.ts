import { NextRequest, NextResponse } from "next/server";
import { getExecutiveAdminUserId } from "@/lib/admin/get-executive-admin-user-id";
import { getDb } from "@/lib/db";
import { buildExecutiveFulfillmentOperationsMemoryInsights } from "@/lib/fulfillment/fulfillment-operations-service";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/executive-agent/fulfillment-operations/memory-insights
 * Read-only operational memory and learning feedback — recommendations only.
 */
export async function GET(req: NextRequest) {
  const adminUserId = await getExecutiveAdminUserId(req);
  if (adminUserId == null) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limit = Number(req.nextUrl.searchParams.get("limit") ?? "80");
  const db = await getDb();
  const insights = await buildExecutiveFulfillmentOperationsMemoryInsights(db, {
    adminUserId,
    limit: Number.isFinite(limit) ? limit : 80,
  });

  return NextResponse.json(insights);
}
