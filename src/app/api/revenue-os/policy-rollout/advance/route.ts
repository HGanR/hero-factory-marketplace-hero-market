import { NextRequest, NextResponse } from "next/server";
import { getAuthedUserId } from "@/lib/api/auth";
import { logBentleyCorrelationEvent } from "@/lib/revenue-os/bentley-correlation-server";
import { advanceBentleyRolloutStage } from "@/lib/revenue-os/rollout-control";

import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
export async function POST(req: NextRequest) {
  const __rosGate = await enforceRevenueOsApiAccess(req);
  if (__rosGate) return __rosGate;
  try {
    logBentleyCorrelationEvent("revenue-os/policy-rollout/advance", req);
    const userId = await getAuthedUserId();
    if (userId == null) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const uid = String(userId);
    const body = (await req.json()) as { planId?: string; runId?: string | null };
    const planId = String(body.planId ?? "").trim();
    if (!planId) {
      return NextResponse.json({ error: "planId required" }, { status: 400 });
    }

    const r = await advanceBentleyRolloutStage({
      userId: uid,
      planId,
      runId: body.runId?.trim() || null,
    });
    if (!r.ok) {
      return NextResponse.json({ error: r.error ?? "Advance failed" }, { status: 400 });
    }
    return NextResponse.json({ ok: true, runId: r.runId });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
