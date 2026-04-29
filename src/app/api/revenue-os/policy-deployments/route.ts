import { NextRequest, NextResponse } from "next/server";
import { getAuthedUserId } from "@/lib/api/auth";
import { logBentleyCorrelationEvent } from "@/lib/revenue-os/bentley-correlation-server";
import { listBentleyPolicyDeployments } from "@/lib/revenue-os/policy-deployment-history";
import { buildDeploymentHistoryTimeline } from "@/lib/revenue-os/policy-deployment-ui";

import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
export async function GET(req: NextRequest) {
  const __rosGate = await enforceRevenueOsApiAccess(req);
  if (__rosGate) return __rosGate;
  try {
    logBentleyCorrelationEvent("revenue-os/policy-deployments", req);
    const userId = await getAuthedUserId();
    if (userId == null) {
      return NextResponse.json({ error: "Unauthorized", signedOut: true }, { status: 401 });
    }
    const uid = String(userId);
    const lim = Math.min(parseInt(req.nextUrl.searchParams.get("limit") || "40", 10) || 40, 200);
    const entries = await listBentleyPolicyDeployments({ userId: uid, limit: lim });
    return NextResponse.json({
      deployments: entries,
      timeline: buildDeploymentHistoryTimeline(entries),
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
