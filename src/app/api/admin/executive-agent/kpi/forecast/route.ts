import { NextRequest, NextResponse } from "next/server";
import { getExecutiveAdminUserId } from "@/lib/admin/get-executive-admin-user-id";
import { getDb } from "@/lib/db";
import { buildExecutiveKpiForecast } from "@/lib/fulfillment/executive-kpi-service";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/executive-agent/kpi/forecast
 * Fulfillment forecasting + risk alerts — confidence-scored, explainable, advisory only.
 */
export async function GET(req: NextRequest) {
  const adminUserId = await getExecutiveAdminUserId(req);
  if (adminUserId == null) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limit = Number(req.nextUrl.searchParams.get("limit") ?? "60");
  const db = await getDb();
  const result = await buildExecutiveKpiForecast(db, {
    adminUserId,
    limit: Number.isFinite(limit) ? limit : 60,
  });
  return NextResponse.json(result);
}
