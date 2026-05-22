import { NextRequest, NextResponse } from "next/server";
import { getExecutiveAdminUserId } from "@/lib/admin/get-executive-admin-user-id";
import { getDb } from "@/lib/db";
import { listAutomationHistoryForAdmin } from "@/lib/executive-agent/executive-automation-service";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/executive-agent/automation/history
 * Auditable automation execution and rollback history.
 */
export async function GET(req: NextRequest) {
  const adminUserId = await getExecutiveAdminUserId(req);
  if (adminUserId == null) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limit = Number(req.nextUrl.searchParams.get("limit") ?? "40");
  const db = await getDb();
  const result = await listAutomationHistoryForAdmin(db, {
    adminUserId,
    limit: Number.isFinite(limit) ? limit : 40,
  });

  return NextResponse.json(result);
}
