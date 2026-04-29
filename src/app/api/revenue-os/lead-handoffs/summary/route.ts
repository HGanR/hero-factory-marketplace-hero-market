import { NextRequest, NextResponse } from "next/server";
import { getAuthedUserId } from "@/lib/api/auth";
import { logBentleyCorrelationEvent } from "@/lib/revenue-os/bentley-correlation-server";
import { fetchLeadHandoffSummary } from "@/lib/revenue-os/lead-handoff";

import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
export async function GET(req: NextRequest) {
  const __rosGate = await enforceRevenueOsApiAccess(req);
  if (__rosGate) return __rosGate;
  try {
    logBentleyCorrelationEvent("revenue-os/lead-handoffs/summary", req);
    const userId = await getAuthedUserId();
    if (userId == null) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get("clientId") ?? "";
    const trustId = searchParams.get("trustId") ?? "";
    const summary = await fetchLeadHandoffSummary({
      userId: String(userId),
      clientId,
      trustId,
    });
    return NextResponse.json(summary);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
