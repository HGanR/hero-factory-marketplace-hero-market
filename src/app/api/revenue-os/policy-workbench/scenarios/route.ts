import { NextRequest, NextResponse } from "next/server";
import { getAuthedUserId } from "@/lib/api/auth";
import { logBentleyCorrelationEvent } from "@/lib/revenue-os/bentley-correlation-server";
import { listPolicyScenariosForUser, getLatestRunForScenario } from "@/lib/revenue-os/policy-scenarios-db";

import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
export async function GET(req: NextRequest) {
  const __rosGate = await enforceRevenueOsApiAccess(req);
  if (__rosGate) return __rosGate;
  try {
    logBentleyCorrelationEvent("revenue-os/policy-workbench/scenarios", req);
    const sp = req.nextUrl.searchParams;
    const clientId = sp.get("clientId")?.trim() || undefined;
    const trustId = sp.get("trustId")?.trim() || undefined;
    const savedOnly = sp.get("savedOnly") !== "false";

    const userId = await getAuthedUserId();
    const generatedAt = new Date().toISOString();
    if (userId == null) {
      return NextResponse.json({ signedOut: true, scenarios: [], generatedAt });
    }

    const uid = String(userId);
    const scenarios = await listPolicyScenariosForUser({
      userId: uid,
      clientId,
      trustId,
      limit: 80,
      savedOnly,
    });

    const withLatest = await Promise.all(
      scenarios.map(async (s) => {
        const latest = await getLatestRunForScenario(s.id);
        return { scenario: s, latestRun: latest };
      })
    );

    return NextResponse.json({
      signedOut: false,
      scenarios: withLatest,
      generatedAt,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
