import { NextRequest, NextResponse } from "next/server";
import { getExecutiveAdminUserId } from "@/lib/admin/get-executive-admin-user-id";
import { getDb } from "@/lib/db";
import { buildExecutiveOperatorWorkload } from "@/lib/executive-agent/operator-coordination-service";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/executive-agent/operators/workload
 * Operator workload, bottlenecks, delegation/escalation intelligence.
 */
export async function GET(req: NextRequest) {
  const adminUserId = await getExecutiveAdminUserId(req);
  if (adminUserId == null) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const db = await getDb();
  const result = await buildExecutiveOperatorWorkload(db, { adminUserId });
  return NextResponse.json(result);
}
