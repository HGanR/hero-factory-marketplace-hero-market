import { NextRequest, NextResponse } from "next/server";
import { getAuthedUserId } from "@/lib/api/auth";
import { logBentleyCorrelationEvent } from "@/lib/revenue-os/bentley-correlation-server";
import { getPolicyScenarioByIdForUser, listRunsForScenario, scenarioScopeMatches } from "@/lib/revenue-os/policy-scenarios-db";

import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, ctx: RouteCtx) {
  const __rosGate = await enforceRevenueOsApiAccess(req);
  if (__rosGate) return __rosGate;
  try {
    logBentleyCorrelationEvent("revenue-os/policy-workbench/scenarios/id", req);
    const { id } = await ctx.params;
    const scenarioId = String(id).trim();
    const userId = await getAuthedUserId();
    const generatedAt = new Date().toISOString();
    const sp = req.nextUrl.searchParams;
    const clientId = sp.get("clientId")?.trim() || undefined;
    const trustId = sp.get("trustId")?.trim() || undefined;

    if (userId == null) {
      return NextResponse.json({ signedOut: true, scenario: null, runs: [], generatedAt });
    }

    const uid = String(userId);
    const scenario = await getPolicyScenarioByIdForUser({ userId: uid, scenarioId });
    if (!scenario) {
      return NextResponse.json({ signedOut: false, scenario: null, runs: [], notFound: true, generatedAt });
    }
    if (
      clientId &&
      trustId &&
      !scenarioScopeMatches(scenario, uid, clientId, trustId)
    ) {
      return NextResponse.json({ signedOut: false, scenario: null, runs: [], forbidden: true, generatedAt });
    }

    const runs = await listRunsForScenario({ scenarioId, limit: 40 });
    return NextResponse.json({
      signedOut: false,
      scenario,
      runs,
      generatedAt,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
