import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getExecutiveAdminUserId } from "@/lib/admin/get-executive-admin-user-id";
import { getDb } from "@/lib/db";
import { executeExecutiveApprovedAction } from "@/lib/executive-agent/executive-action-executors";
import {
  getExecutiveApprovalForGate,
  claimPendingExecutiveApproval,
} from "@/lib/executive-agent/executive-agent-approvals-store";
import { approveExecutiveAction } from "@/lib/executive-agent/approve-executive-action";
import { insertExecutiveAgentAuditLog } from "@/lib/executive-agent/executive-agent-audit";

export const dynamic = "force-dynamic";
type RouteCtx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: RouteCtx) {
  const adminUserId = await getExecutiveAdminUserId(req);
  if (adminUserId == null) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const db = await getDb();
  return approveExecutiveAction(req, id, adminUserId, {
    read: (approvalId) => getExecutiveApprovalForGate(db, approvalId),
    claim: (approvalId, owner) => claimPendingExecutiveApproval(db, approvalId, owner),
    execute: (approval, owner) => executeExecutiveApprovedAction(db, { adminUserId: owner, approval }),
    auditRefusal: async (refusal) => {
      await insertExecutiveAgentAuditLog(db, {
        id: randomUUID(), prompt: null, adminUserId,
        toolName: "executive.approvals.approve", actionType: "approval_refused",
        targetType: "approval", targetId: id,
        outputJson: JSON.stringify({ code: refusal.code }),
        approvalStatus: refusal.status ?? "not_required",
      });
    },
  });
}

