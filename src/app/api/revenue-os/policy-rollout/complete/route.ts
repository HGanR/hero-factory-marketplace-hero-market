import { NextRequest, NextResponse } from "next/server";
import { getAuthedUserId } from "@/lib/api/auth";
import { logBentleyCorrelationEvent } from "@/lib/revenue-os/bentley-correlation-server";
import { completeBentleyRollout } from "@/lib/revenue-os/rollout-control";

import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
export async function POST(req: NextRequest) {
  const __rosGate = await enforceRevenueOsApiAccess(req);
  if (__rosGate) return __rosGate;
  try {
    logBentleyCorrelationEvent("revenue-os/policy-rollout/complete", req);
    const userId = await getAuthedUserId();
    if (userId == null) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const uid = String(userId);
    const body = (await req.json()) as { runId?: string };
    const runId = String(body.runId ?? "").trim();
    if (!runId) {
      return NextResponse.json({ error: "runId required" }, { status: 400 });
    }

    const r = await completeBentleyRollout({ userId: uid, runId });
    if (!r.ok) {
      return NextResponse.json({ error: r.error ?? "Complete failed" }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
