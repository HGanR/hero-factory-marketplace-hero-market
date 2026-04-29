import { NextRequest, NextResponse } from "next/server";
import { getAuthedUserId } from "@/lib/api/auth";
import { logBentleyCorrelationEvent } from "@/lib/revenue-os/bentley-correlation-server";
import { listBentleyApprovalRequests } from "@/lib/revenue-os/autonomous-approval-queue";

import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
export async function GET(req: NextRequest) {
  const __rosGate = await enforceRevenueOsApiAccess(req);
  if (__rosGate) return __rosGate;
  try {
    logBentleyCorrelationEvent("revenue-os/autonomous/approval-requests", req);
    const userId = await getAuthedUserId();
    if (userId == null) {
      return NextResponse.json({ ok: true, requests: [], signedOut: true });
    }
    const sp = req.nextUrl.searchParams;
    const clientId = sp.get("clientId")?.trim() || undefined;
    const trustId = sp.get("trustId")?.trim() || undefined;
    const approvalStatus = sp.get("status")?.trim() || undefined;
    const actionType = sp.get("actionType")?.trim() || undefined;
    const limit = Math.min(200, Math.max(1, Number(sp.get("limit")) || 80));
    const rows = await listBentleyApprovalRequests({
      userId: String(userId),
      clientId,
      trustId,
      approvalStatus,
      actionType,
      limit,
    });
    return NextResponse.json({
      ok: true,
      requests: rows.map((r) => ({
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
      })),
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }
}
