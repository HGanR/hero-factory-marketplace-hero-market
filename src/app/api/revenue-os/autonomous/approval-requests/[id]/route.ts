import { NextRequest, NextResponse } from "next/server";
import { getAuthedUserId } from "@/lib/api/auth";
import { logBentleyCorrelationEvent } from "@/lib/revenue-os/bentley-correlation-server";
import { getBentleyApprovalRequestById } from "@/lib/revenue-os/autonomous-approval-queue";

import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const __rosGate = await enforceRevenueOsApiAccess(req);
  if (__rosGate) return __rosGate;
  try {
    logBentleyCorrelationEvent("revenue-os/autonomous/approval-requests/[id]", req);
    const userId = await getAuthedUserId();
    if (userId == null) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await ctx.params;
    const r = await getBentleyApprovalRequestById({ userId: String(userId), id });
    if (!r) {
      return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    }
    return NextResponse.json({
      ok: true,
      request: {
        id: r.id,
        autonomousRunId: r.autonomousRunId,
        clientId: r.clientId,
        trustId: r.trustId,
        actionType: r.actionType,
        approvalStatus: r.approvalStatus,
        severity: r.severity,
        reason: r.reason,
        rationaleJson: r.rationaleJson,
        decisionPayloadJson: r.decisionPayloadJson,
        targetIdsJson: r.targetIdsJson,
        requestedAt: r.requestedAt?.toISOString?.() ?? null,
        reviewedAt: r.reviewedAt?.toISOString?.() ?? null,
        reviewedByUserId: r.reviewedByUserId,
        reviewNote: r.reviewNote,
        expiresAt: r.expiresAt?.toISOString?.() ?? null,
        createdAt: r.createdAt?.toISOString?.() ?? null,
        updatedAt: r.updatedAt?.toISOString?.() ?? null,
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }
}
