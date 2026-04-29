import { NextRequest, NextResponse } from "next/server";
import { getAuthedUserId } from "@/lib/api/auth";
import { logBentleyCorrelationEvent } from "@/lib/revenue-os/bentley-correlation-server";
import { buildPolicyRollbackPrepareResponse } from "@/lib/revenue-os/rollback-api-helpers";
import { getPolicyRollbackPackageByIdForUser } from "@/lib/revenue-os/policy-rollback-db";
import type { BentleyRollbackType } from "@/lib/revenue-os/policy-rollback-db";

import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
export async function GET(req: NextRequest) {
  const __rosGate = await enforceRevenueOsApiAccess(req);
  if (__rosGate) return __rosGate;
  try {
    logBentleyCorrelationEvent("revenue-os/policy-rollback/current", req);
    const userId = await getAuthedUserId();
    if (userId == null) {
      return NextResponse.json({ signedOut: true, error: "Unauthorized" }, { status: 401 });
    }
    const uid = String(userId);
    const sp = req.nextUrl.searchParams;
    const planId = sp.get("planId")?.trim() || undefined;
    const scenarioId = sp.get("scenarioId")?.trim() || undefined;
    const clientId = sp.get("clientId")?.trim() || undefined;
    const trustId = sp.get("trustId")?.trim() || undefined;
    const rollbackType = (sp.get("rollbackType")?.trim() || "blended") as BentleyRollbackType;
    const packageId = sp.get("packageId")?.trim() || undefined;

    if (!planId && !scenarioId) {
      return NextResponse.json({ error: "planId or scenarioId required" }, { status: 400 });
    }

    const existing = packageId
      ? await getPolicyRollbackPackageByIdForUser({ userId: uid, packageId })
      : null;

    const { engine, bundle, ui, staleWarning } = await buildPolicyRollbackPrepareResponse({
      userId: uid,
      clientId: clientId ?? null,
      trustId: trustId ?? null,
      planId: planId ?? null,
      scenarioId: scenarioId ?? null,
      rollbackType,
      packageRow: existing,
    });

    return NextResponse.json({
      signedOut: false,
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
