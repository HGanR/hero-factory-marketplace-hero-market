import { NextRequest, NextResponse } from "next/server";
import { getExecutiveAdminUserId } from "@/lib/admin/get-executive-admin-user-id";
import { getDb } from "@/lib/db";
import { buildExecutiveKpiOverview } from "@/lib/fulfillment/executive-kpi-service";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/executive-agent/kpi/overview
 * Executive KPI desk metrics — advisory analytics only; no autonomous corrective actions.
 */
export async function GET(req: NextRequest) {
  const adminUserId = await getExecutiveAdminUserId(req);
  if (adminUserId == null) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limit = Number(req.nextUrl.searchParams.get("limit") ?? "60");
  const db = await getDb();
  const result = await buildExecutiveKpiOverview(db, {
    adminUserId,
    limit: Number.isFinite(limit) ? limit : 60,
  });
  return NextResponse.json(result);
}
