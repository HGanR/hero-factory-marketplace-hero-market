import { NextRequest, NextResponse } from "next/server";
import { getExecutiveAdminUserId } from "@/lib/admin/get-executive-admin-user-id";
import { getDb } from "@/lib/db";
import { buildExecutiveWorkflowDetailForAdmin } from "@/lib/executive-agent/executive-workflow-service";

export const dynamic = "force-dynamic";

type RouteCtx = { params: Promise<{ id: string }> };

/** GET /api/admin/executive-agent/workflows/[id] */
export async function GET(_req: NextRequest, ctx: RouteCtx) {
  const adminUserId = await getExecutiveAdminUserId(_req);
  if (adminUserId == null) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const db = await getDb();
  const result = await buildExecutiveWorkflowDetailForAdmin(db, {
    adminUserId,
    workflowId: decodeURIComponent(id),
  });
  if (!result) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  return NextResponse.json(result);
}
