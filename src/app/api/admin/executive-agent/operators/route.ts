import { NextRequest, NextResponse } from "next/server";
import { getExecutiveAdminUserId } from "@/lib/admin/get-executive-admin-user-id";
import { getDb } from "@/lib/db";
import { buildExecutiveOperatorsRegistry } from "@/lib/executive-agent/operator-coordination-service";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/executive-agent/operators
 * Governed operator registry — advisory coordination only.
 */
export async function GET(req: NextRequest) {
  const adminUserId = await getExecutiveAdminUserId(req);
  if (adminUserId == null) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const db = await getDb();
  const result = await buildExecutiveOperatorsRegistry(db, { adminUserId });
  return NextResponse.json(result);
}
