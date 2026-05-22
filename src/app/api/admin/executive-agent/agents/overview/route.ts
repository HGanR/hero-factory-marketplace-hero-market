import { NextRequest, NextResponse } from "next/server";
import { getExecutiveAdminUserId } from "@/lib/admin/get-executive-admin-user-id";
import { getDb } from "@/lib/db";
import { buildExecutiveAgentCoordinationOverviewForAdmin } from "@/lib/executive-agent/executive-agent-coordination-service";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/executive-agent/agents/overview
 * Multi-agent coordination overview — explainable, approval-aware, hierarchy-governed.
 */
export async function GET(req: NextRequest) {
  const adminUserId = await getExecutiveAdminUserId(req);
  if (adminUserId == null) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = await getDb();
  const result = await buildExecutiveAgentCoordinationOverviewForAdmin(db, { adminUserId });
  return NextResponse.json(result);
}
