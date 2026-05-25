import { NextRequest, NextResponse } from "next/server";
import { getExecutiveAdminUserId } from "@/lib/admin/get-executive-admin-user-id";
import { getDb } from "@/lib/db";
import { insertExecutiveAgentAuditLog } from "@/lib/executive-agent/executive-agent-audit";
import {
  getExecutiveApprovalById,
  setExecutiveApprovalStatus,
} from "@/lib/executive-agent/executive-agent-approvals-store";
import { randomUUID } from "crypto";

export const dynamic = "force-dynamic";

type RouteCtx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: RouteCtx) {
  const adminUserId = await getExecutiveAdminUserId(req);
  if (adminUserId == null) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const db = await getDb();
  const row = await getExecutiveApprovalById(db, id, adminUserId);
  if (!row) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  if (row.status !== "pending") {
    return NextResponse.json({ error: "INVALID_STATE" }, { status: 409 });
  }
  await setExecutiveApprovalStatus(db, id, adminUserId, "rejected");
  await insertExecutiveAgentAuditLog(db, {
    id: randomUUID(),
    adminUserId,
    prompt: null,
    toolName: "approval.reject",
    actionType: row.proposedAction,
    targetType: "approval_queue",
    targetId: id,
    inputJson: row.payloadJson.slice(0, 50_000),
    outputJson: JSON.stringify({ status: "rejected" }),
    approvalStatus: "rejected",
  });
  return NextResponse.json({ ok: true });
}
