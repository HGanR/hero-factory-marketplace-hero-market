import { NextRequest, NextResponse } from "next/server";
import { getExecutiveAdminUserId } from "@/lib/admin/get-executive-admin-user-id";
import { getDb } from "@/lib/db";
import { isExecutiveSubjectId } from "@/lib/executive-agent/executive-subject-nav";
import { buildSubjectExecutiveWorkspace } from "@/lib/executive-agent/subject-workspace-service";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/executive-agent/subject-workspace
 * Read-only subject-scoped workspace for Skipper (timeline, recommendations, memory).
 */
export async function GET(req: NextRequest) {
  const adminUserId = await getExecutiveAdminUserId(req);
  if (adminUserId == null) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const subjectId = req.nextUrl.searchParams.get("subjectId") ?? "command_center";
  if (!isExecutiveSubjectId(subjectId)) {
    return NextResponse.json({ error: "invalid_subject_id" }, { status: 400 });
  }

  const clientId = req.nextUrl.searchParams.get("clientId");
  const orderId = req.nextUrl.searchParams.get("orderId");

  const db = await getDb();
  const workspace = await buildSubjectExecutiveWorkspace(db, {
    adminUserId,
    subjectId,
    clientId,
    orderId,
  });

  return NextResponse.json(workspace);
}
