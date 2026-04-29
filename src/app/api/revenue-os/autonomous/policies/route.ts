import { NextRequest, NextResponse } from "next/server";
import { getAuthedUserId } from "@/lib/api/auth";
import { logBentleyCorrelationEvent } from "@/lib/revenue-os/bentley-correlation-server";
import { listAutonomousPoliciesForUser } from "@/lib/revenue-os/autonomous-policies-db";

import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
export async function GET(req: NextRequest) {
  const __rosGate = await enforceRevenueOsApiAccess(req);
  if (__rosGate) return __rosGate;
  try {
    logBentleyCorrelationEvent("revenue-os/autonomous/policies", req);
    const userId = await getAuthedUserId();
    if (userId == null) {
      return NextResponse.json({ ok: true, policies: [], signedOut: true });
    }
    const sp = req.nextUrl.searchParams;
    const clientId = sp.get("clientId")?.trim() || undefined;
    const trustId = sp.get("trustId")?.trim() || undefined;
    const rows = await listAutonomousPoliciesForUser({
      userId: String(userId),
      clientId,
      trustId,
    });
    return NextResponse.json({
      ok: true,
      policies: rows.map((p) => ({
        id: p.id,
        clientId: p.clientId,
        trustId: p.trustId,
        actionType: p.actionType,
        isEnabled: p.isEnabled,
        requiresApprovalAboveSeverity: p.requiresApprovalAboveSeverity,
        maxDailyExecutions: p.maxDailyExecutions,
        cooldownMinutes: p.cooldownMinutes,
        policyConfigJson: p.policyConfigJson,
        createdAt: p.createdAt?.toISOString() ?? null,
        updatedAt: p.updatedAt?.toISOString() ?? null,
      })),
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }
}
