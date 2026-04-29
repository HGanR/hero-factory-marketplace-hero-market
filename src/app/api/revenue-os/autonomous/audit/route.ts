import { NextRequest, NextResponse } from "next/server";
import { getAuthedUserId } from "@/lib/api/auth";
import { logBentleyCorrelationEvent } from "@/lib/revenue-os/bentley-correlation-server";
import { listBentleyAutonomousAuditEntries } from "@/lib/revenue-os/autonomous-audit";

import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
export async function GET(req: NextRequest) {
  const __rosGate = await enforceRevenueOsApiAccess(req);
  if (__rosGate) return __rosGate;
  try {
    logBentleyCorrelationEvent("revenue-os/autonomous/audit", req);
    const userId = await getAuthedUserId();
    if (userId == null) {
      return NextResponse.json({ ok: true, entries: [], signedOut: true });
    }
    const sp = req.nextUrl.searchParams;
    const clientId = sp.get("clientId")?.trim() || undefined;
    const trustId = sp.get("trustId")?.trim() || undefined;
    const actionType = sp.get("actionType")?.trim() || undefined;
    const actionStatus = sp.get("status")?.trim() || undefined;
    const sinceMs = sp.get("sinceMs") ? Number(sp.get("sinceMs")) : undefined;
    const untilMs = sp.get("untilMs") ? Number(sp.get("untilMs")) : undefined;
    const limit = Math.min(500, Math.max(1, Number(sp.get("limit")) || 80));
    const rows = await listBentleyAutonomousAuditEntries({
      userId: String(userId),
      clientId,
      trustId,
      actionType,
      actionStatus,
      sinceMs,
      untilMs,
      limit,
    });
    return NextResponse.json({
      ok: true,
      entries: rows.map((r) => ({
        id: r.id,
        userId: r.userId,
        clientId: r.clientId,
        trustId: r.trustId,
        sourceType: r.sourceType,
        actionType: r.actionType,
        actionStatus: r.actionStatus,
        relatedRunId: r.relatedRunId,
        relatedApprovalRequestId: r.relatedApprovalRequestId,
        targetIdsJson: r.targetIdsJson,
        actionPayloadJson: r.actionPayloadJson,
        resultPayloadJson: r.resultPayloadJson,
        rationaleJson: r.rationaleJson,
        createdAt: r.createdAt?.toISOString?.() ?? null,
      })),
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }
}
