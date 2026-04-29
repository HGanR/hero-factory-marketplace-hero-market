import { NextRequest, NextResponse } from "next/server";
import { getAuthedUserId } from "@/lib/api/auth";
import { logBentleyCorrelationEvent } from "@/lib/revenue-os/bentley-correlation-server";
import { getPolicyRollbackPackageByIdForUser } from "@/lib/revenue-os/policy-rollback-db";
import { buildStoredRollbackResponse } from "@/lib/revenue-os/rollback-api-helpers";

import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
type RouteParams = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, ctx: RouteParams) {
  const __rosGate = await enforceRevenueOsApiAccess(req);
  if (__rosGate) return __rosGate;
  try {
    logBentleyCorrelationEvent("revenue-os/policy-rollback/packages/[id]", req);
    const userId = await getAuthedUserId();
    if (userId == null) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const uid = String(userId);
    const { id } = await ctx.params;
    const packageId = String(id ?? "").trim();
    if (!packageId) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }

    const row = await getPolicyRollbackPackageByIdForUser({ userId: uid, packageId });
    if (!row) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const { engine, bundle, ui, staleWarning } = await buildStoredRollbackResponse({
      userId: uid,
      row,
    });

    return NextResponse.json({
      package: row,
      rollbackPackage: engine.rollbackPackage,
      deltaSummary: engine.deltaSummary,
      riskSummary: engine.riskSummary,
      recommendation: engine.recommendation,
      affectedScopes: engine.affectedScopes,
      affectedPolicyFamilies: engine.affectedPolicyFamilies,
      bundle,
      ui,
      staleWarning,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
