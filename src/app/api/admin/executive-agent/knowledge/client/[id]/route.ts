import { NextRequest, NextResponse } from "next/server";
import { getExecutiveAdminUserId } from "@/lib/admin/get-executive-admin-user-id";
import { getDb } from "@/lib/db";
import { buildExecutiveKnowledgeClientForAdmin } from "@/lib/executive-agent/executive-knowledge-service";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/admin/executive-agent/knowledge/client/[id]
 * Client-scoped long-horizon knowledge — read-only.
 */
export async function GET(req: NextRequest, context: RouteContext) {
  const adminUserId = await getExecutiveAdminUserId(req);
  if (adminUserId == null) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: clientId } = await context.params;
  const limit = Number(req.nextUrl.searchParams.get("limit") ?? "60");
  const db = await getDb();
  const result = await buildExecutiveKnowledgeClientForAdmin(db, {
    adminUserId,
    clientId,
    limit: Number.isFinite(limit) ? limit : 60,
  });

  if (!result.ok) {
    return NextResponse.json(result, { status: result.error === "client_id_required" ? 400 : 404 });
  }
  return NextResponse.json(result);
}
