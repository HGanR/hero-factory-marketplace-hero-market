import { NextRequest, NextResponse } from "next/server";
import { getExecutiveAdminUserId } from "@/lib/admin/get-executive-admin-user-id";
import { getDb } from "@/lib/db";
import { buildExecutiveFulfillmentOperationsBriefing } from "@/lib/fulfillment/fulfillment-operations-service";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/executive-agent/fulfillment-operations/briefing
 * Read-only executive operations briefing for Skipper + desk — recommendations only.
 */
export async function GET(req: NextRequest) {
  const adminUserId = await getExecutiveAdminUserId(req);
  if (adminUserId == null) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limit = Number(req.nextUrl.searchParams.get("limit") ?? "50");
  const db = await getDb();
  const briefing = await buildExecutiveFulfillmentOperationsBriefing(db, {
    adminUserId,
    limit: Number.isFinite(limit) ? limit : 50,
  });

  return NextResponse.json(briefing);
}
