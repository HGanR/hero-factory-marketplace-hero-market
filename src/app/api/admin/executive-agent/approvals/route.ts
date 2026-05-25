import { NextRequest, NextResponse } from "next/server";
import { getExecutiveAdminUserId } from "@/lib/admin/get-executive-admin-user-id";
import { getDb } from "@/lib/db";
import { listExecutiveApprovals } from "@/lib/executive-agent/executive-agent-approvals-store";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const adminUserId = await getExecutiveAdminUserId(req);
  if (adminUserId == null) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const status = req.nextUrl.searchParams.get("status");
  const allowed = ["pending", "approved", "rejected", "executed", "failed"] as const;
  const st = allowed.includes(status as (typeof allowed)[number]) ? (status as (typeof allowed)[number]) : undefined;
  const db = await getDb();
  const rows = await listExecutiveApprovals(db, { adminUserId, status: st, limit: 100 });
  return NextResponse.json({ approvals: rows });
}
