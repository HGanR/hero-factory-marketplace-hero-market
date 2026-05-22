import { NextRequest, NextResponse } from "next/server";
import { getExecutiveAdminUserId } from "@/lib/admin/get-executive-admin-user-id";
import { getDb } from "@/lib/db";
import { buildExecutiveSimulationOverview } from "@/lib/executive-agent/executive-simulation-service";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/executive-agent/simulation/overview
 * Available simulation scenarios and baseline desk preview — read-only.
 */
export async function GET(req: NextRequest) {
  const adminUserId = await getExecutiveAdminUserId(req);
  if (adminUserId == null) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limit = Number(req.nextUrl.searchParams.get("limit") ?? "60");
  const db = await getDb();
  const result = await buildExecutiveSimulationOverview(db, {
    adminUserId,
    limit: Number.isFinite(limit) ? limit : 60,
  });
  return NextResponse.json(result);
}
