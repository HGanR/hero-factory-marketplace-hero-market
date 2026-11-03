import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { getExecutiveAdminUserId } from "@/lib/admin/get-executive-admin-user-id";
import { getDb } from "@/lib/db";
import { executiveAgentApprovals } from "@/lib/db/schema";
import { getExecutiveApprovalForGate } from "@/lib/executive-agent/executive-agent-approvals-store";
import { insertExecutiveAgentAuditLog } from "@/lib/executive-agent/executive-agent-audit";
import { rejectExecutiveAction } from "@/lib/executive-agent/reject-executive-action";
export const dynamic = "force-dynamic";
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const adminUserId = await getExecutiveAdminUserId(req);
  if (adminUserId == null) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const db = await getDb();
  return rejectExecutiveAction(req, id, adminUserId, {
    read: key => getExecutiveApprovalForGate(db, key),
    auditRefusal: refusal => insertExecutiveAgentAuditLog(db, { id: randomUUID(), adminUserId, prompt: null,
      toolName: "approval.reject", actionType: "approval_refused", targetType: "approval_queue", targetId: id,
      inputJson: null, outputJson: JSON.stringify({ code: refusal.code }), approvalStatus: "not_required" }),
    rejectPending: (key, owner) => db.transaction(async tx => {
      const [result] = await tx.update(executiveAgentApprovals).set({ status: "rejected" })
        .where(and(eq(executiveAgentApprovals.id, key), eq(executiveAgentApprovals.adminUserId, owner), eq(executiveAgentApprovals.status, "pending")));
      if (result.affectedRows !== 1) return false;
      await insertExecutiveAgentAuditLog(tx as unknown as Parameters<typeof insertExecutiveAgentAuditLog>[0], {
        id: randomUUID(), adminUserId: owner, prompt: null, toolName: "approval.reject", actionType: "approval_rejected",
        targetType: "approval_queue", targetId: key, inputJson: null, outputJson: JSON.stringify({ status: "rejected" }), approvalStatus: "rejected" });
      return true;
    }),
  });
}

