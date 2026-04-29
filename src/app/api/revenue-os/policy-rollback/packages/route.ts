import { NextRequest, NextResponse } from "next/server";
import { getAuthedUserId } from "@/lib/api/auth";
import { logBentleyCorrelationEvent } from "@/lib/revenue-os/bentley-correlation-server";
import { listPolicyRollbackPackagesForUser } from "@/lib/revenue-os/policy-rollback-db";

import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
export async function GET(req: NextRequest) {
  const __rosGate = await enforceRevenueOsApiAccess(req);
  if (__rosGate) return __rosGate;
  try {
    logBentleyCorrelationEvent("revenue-os/policy-rollback/packages", req);
    const userId = await getAuthedUserId();
    if (userId == null) {
      return NextResponse.json({ signedOut: true, packages: [] });
    }
    const lim = Math.min(Math.max(Number(req.nextUrl.searchParams.get("limit")) || 40, 1), 100);
    const packages = await listPolicyRollbackPackagesForUser({ userId: String(userId), limit: lim });
    return NextResponse.json({ signedOut: false, packages });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
