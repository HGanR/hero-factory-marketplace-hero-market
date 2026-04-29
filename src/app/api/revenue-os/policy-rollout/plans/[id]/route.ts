import { NextRequest, NextResponse } from "next/server";
import { getAuthedUserId } from "@/lib/api/auth";
import { logBentleyCorrelationEvent } from "@/lib/revenue-os/bentley-correlation-server";
import { getPolicyRolloutPlanByIdForUser } from "@/lib/revenue-os/policy-rollout-db";

import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  const __rosGate = await enforceRevenueOsApiAccess(req);
  if (__rosGate) return __rosGate;
  try {
    logBentleyCorrelationEvent("revenue-os/policy-rollout/plans/id", req);
    const userId = await getAuthedUserId();
    if (userId == null) {
      return NextResponse.json({ signedOut: true, plan: null }, { status: 401 });
    }

    const { id } = await ctx.params;
    const plan = await getPolicyRolloutPlanByIdForUser({ userId: String(userId), planId: id });
    if (!plan) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ signedOut: false, plan });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
