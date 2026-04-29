import { NextRequest, NextResponse } from "next/server";
import { getAuthedUserId } from "@/lib/api/auth";
import { logBentleyCorrelationEvent } from "@/lib/revenue-os/bentley-correlation-server";
import { buildBentleyOperatorOverview } from "@/lib/revenue-os/operator-intelligence";
import {
  getPolicyRolloutPlanByIdForUser,
  getLatestRolloutRunForPlan,
  type PolicyRolloutPlanRow,
} from "@/lib/revenue-os/policy-rollout-db";
import { monitorBentleyRolloutPlan } from "@/lib/revenue-os/rollout-monitoring";
import { buildRolloutMonitoringUiPayload } from "@/lib/revenue-os/rollout-monitoring-ui";

import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
function scopeFromPlan(plan: PolicyRolloutPlanRow): { clientId?: string; trustId?: string } {
  const s = plan.scopeJson;
  if (!s || typeof s !== "object") return {};
  const o = s as Record<string, unknown>;
  return {
    clientId: typeof o.clientId === "string" ? o.clientId : undefined,
    trustId: typeof o.trustId === "string" ? o.trustId : undefined,
  };
}

export async function GET(req: NextRequest) {
  const __rosGate = await enforceRevenueOsApiAccess(req);
  if (__rosGate) return __rosGate;
  try {
    logBentleyCorrelationEvent("revenue-os/policy-rollout/monitor", req);
    const userId = await getAuthedUserId();
    if (userId == null) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const uid = String(userId);
    const planId = req.nextUrl.searchParams.get("planId")?.trim();
    if (!planId) {
      return NextResponse.json({ error: "planId required" }, { status: 400 });
    }

    const plan = await getPolicyRolloutPlanByIdForUser({ userId: uid, planId });
    if (!plan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    const run = await getLatestRolloutRunForPlan({ rolloutPlanId: plan.id });
    const sc = scopeFromPlan(plan);
    const overview = await buildBentleyOperatorOverview({
      userId: uid,
      clientIds: sc.clientId ? [sc.clientId] : undefined,
      trustIds: sc.trustId ? [sc.trustId] : undefined,
    });

    const monitoring = monitorBentleyRolloutPlan({ plan, run, overview });
    const ui = buildRolloutMonitoringUiPayload(monitoring, { planId: plan.id, runId: run?.id ?? null });

    return NextResponse.json({
      plan,
      run,
      monitoring,
      ui,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
