import { NextRequest, NextResponse } from "next/server";
import { getAuthedUserId } from "@/lib/api/auth";
import { logBentleyCorrelationEvent } from "@/lib/revenue-os/bentley-correlation-server";
import { getCurrentPolicyChangeSetForUser } from "@/lib/revenue-os/policy-change-sets-db";
import { fetchBentleyPolicyChangeSetState } from "@/lib/revenue-os/policy-deployment";

import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
export async function GET(req: NextRequest) {
  const __rosGate = await enforceRevenueOsApiAccess(req);
  if (__rosGate) return __rosGate;
  try {
    logBentleyCorrelationEvent("revenue-os/policy-deployments/current", req);
    const userId = await getAuthedUserId();
    if (userId == null) {
      return NextResponse.json({ error: "Unauthorized", signedOut: true }, { status: 401 });
    }
    const uid = String(userId);
    const row = await getCurrentPolicyChangeSetForUser({ userId: uid });
    if (!row) {
      return NextResponse.json({ changeSet: null, items: [], runs: [] });
    }
    const state = await fetchBentleyPolicyChangeSetState({ userId: uid, changeSetId: row.id });
    return NextResponse.json(state ?? { changeSet: row, items: [], runs: [] });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
