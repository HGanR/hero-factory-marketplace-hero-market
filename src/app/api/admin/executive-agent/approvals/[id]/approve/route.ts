import { NextRequest, NextResponse } from "next/server";
import { getExecutiveAdminUserId } from "@/lib/admin/get-executive-admin-user-id";
import { getDb } from "@/lib/db";
import { executeExecutiveApprovedAction } from "@/lib/executive-agent/executive-action-executors";
import {
  getExecutiveApprovalById,
  setExecutiveApprovalStatus,
} from "@/lib/executive-agent/executive-agent-approvals-store";

export const dynamic = "force-dynamic";

type RouteCtx = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, ctx: RouteCtx) {
  const adminUserId = await getExecutiveAdminUserId(_req);
  if (adminUserId == null) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const db = await getDb();
  const row = await getExecutiveApprovalById(db, id, adminUserId);
  if (!row) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  if (row.status !== "pending") {
    return NextResponse.json({ error: "INVALID_STATE", message: "Only pending approvals can be approved." }, { status: 409 });
  }

  await setExecutiveApprovalStatus(db, id, adminUserId, "approved");

  const exec = await executeExecutiveApprovedAction(db, { adminUserId, approval: row });

  await setExecutiveApprovalStatus(db, id, adminUserId, exec.ok ? "executed" : "failed", {
    executedAt: new Date(),
  });

  return NextResponse.json({
    ok: exec.ok,
    message: exec.message,
    status: exec.status,
    data: exec.data,
  });
}
