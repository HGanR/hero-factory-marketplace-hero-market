import { NextRequest, NextResponse } from "next/server";
import { getExecutiveAdminUserId } from "@/lib/admin/get-executive-admin-user-id";
import { getDb } from "@/lib/db";
import { buildExecutiveKnowledgeOperatorForAdmin } from "@/lib/executive-agent/executive-knowledge-service";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/admin/executive-agent/knowledge/operator/[id]
 * Operator specialization and institutional knowledge — read-only.
 */
export async function GET(req: NextRequest, context: RouteContext) {
  const adminUserId = await getExecutiveAdminUserId(req);
  if (adminUserId == null) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: operatorId } = await context.params;
  const limit = Number(req.nextUrl.searchParams.get("limit") ?? "60");
  const db = await getDb();
  const result = await buildExecutiveKnowledgeOperatorForAdmin(db, {
    adminUserId,
    operatorId,
    limit: Number.isFinite(limit) ? limit : 60,
  });

  if (!result.ok) {
    return NextResponse.json(result, { status: 400 });
  }
  return NextResponse.json(result);
}
