import { NextRequest, NextResponse } from "next/server";
import { getAuthedUserId } from "@/lib/api/auth";
import { logBentleyCorrelationEvent } from "@/lib/revenue-os/bentley-correlation-server";
import { listAutonomousRunsForUser } from "@/lib/revenue-os/autonomous-policies-db";

import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
export async function GET(req: NextRequest) {
  const __rosGate = await enforceRevenueOsApiAccess(req);
  if (__rosGate) return __rosGate;
  try {
    logBentleyCorrelationEvent("revenue-os/autonomous/runs", req);
    const userId = await getAuthedUserId();
    if (userId == null) {
      return NextResponse.json({ ok: true, runs: [], signedOut: true });
    }
    const sp = req.nextUrl.searchParams;
    const limit = Math.min(200, Math.max(1, Number(sp.get("limit")) || 40));
    const clientId = sp.get("clientId")?.trim() || undefined;
    const trustId = sp.get("trustId")?.trim() || undefined;
    const rows = await listAutonomousRunsForUser({
      userId: String(userId),
      limit,
      clientId,
      trustId,
    });
    return NextResponse.json({
      ok: true,
      runs: rows.map((r) => ({
        id: r.id,
        policyId: r.policyId,
        actionType: r.actionType,
        runStatus: r.runStatus,
        scopeJson: r.scopeJson,
        decisionSummaryJson: r.decisionSummaryJson,
        executedCount: r.executedCount,
        skippedCount: r.skippedCount,
        startedAt: r.startedAt?.toISOString?.() ?? null,
        completedAt: r.completedAt?.toISOString?.() ?? null,
        createdAt: r.createdAt?.toISOString?.() ?? null,
      })),
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }
}
