import { NextRequest, NextResponse } from "next/server";
import { getAuthedUserId } from "@/lib/api/auth";
import { logBentleyCorrelationEvent } from "@/lib/revenue-os/bentley-correlation-server";
import { listAutomationPoliciesForUser } from "@/lib/revenue-os/automation-policies-db";

import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
export async function GET(req: NextRequest) {
  const __rosGate = await enforceRevenueOsApiAccess(req);
  if (__rosGate) return __rosGate;
  try {
    logBentleyCorrelationEvent("revenue-os/automations/policies", req);
    const userId = await getAuthedUserId();
    if (userId == null) {
      return NextResponse.json({ ok: true, policies: [], signedOut: true });
    }
    const sp = req.nextUrl.searchParams;
    const clientId = sp.get("clientId")?.trim() || undefined;
    const trustId = sp.get("trustId")?.trim() || undefined;
    const policies = await listAutomationPoliciesForUser({
      userId: String(userId),
      clientId,
      trustId,
    });
    return NextResponse.json({
      ok: true,
      policies: policies.map((p) => ({
        id: p.id,
        userId: p.userId,
        clientId: p.clientId,
        trustId: p.trustId,
        policyType: p.policyType,
        isEnabled: p.isEnabled,
        scheduleJson: p.scheduleJson,
        policyConfigJson: p.policyConfigJson,
        lastRunAt: p.lastRunAt?.toISOString() ?? null,
        nextRunAt: p.nextRunAt?.toISOString() ?? null,
        createdAt: p.createdAt?.toISOString() ?? null,
        updatedAt: p.updatedAt?.toISOString() ?? null,
      })),
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }
}
