import { NextRequest, NextResponse } from "next/server";
import { getAuthedUserId } from "@/lib/api/auth";
import { logBentleyCorrelationEvent } from "@/lib/revenue-os/bentley-correlation-server";
import { insertPolicyRolloutPlan, type BentleyRolloutType } from "@/lib/revenue-os/policy-rollout-db";
import { getPolicyScenarioByIdForUser } from "@/lib/revenue-os/policy-scenarios-db";
import { rolloutStrategyByPreset, type RolloutStrategyPreset } from "@/lib/revenue-os/rollout-strategies";

import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
export async function POST(req: NextRequest) {
  const __rosGate = await enforceRevenueOsApiAccess(req);
  if (__rosGate) return __rosGate;
  try {
    logBentleyCorrelationEvent("revenue-os/policy-rollout/save", req);
    const userId = await getAuthedUserId();
    if (userId == null) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as {
      name: string;
      rolloutType?: BentleyRolloutType;
      sourceScenarioId?: string | null;
      strategyPreset?: RolloutStrategyPreset;
      scopeJson?: Record<string, unknown> | null;
      guardrailsJson?: Record<string, unknown> | null;
      rollbackPlanJson?: Record<string, unknown> | null;
    };

    const uid = String(userId);
    const name = String(body.name ?? "").trim();
    if (!name) {
      return NextResponse.json({ error: "name required" }, { status: 400 });
    }

    let sourceScenarioId: string | null = body.sourceScenarioId?.trim() || null;
    if (sourceScenarioId) {
      const sc = await getPolicyScenarioByIdForUser({ userId: uid, scenarioId: sourceScenarioId });
      if (!sc) {
        return NextResponse.json({ error: "Scenario not found or not owned" }, { status: 400 });
      }
    }

    const preset = body.strategyPreset ?? "balanced";
    const strategyJson = rolloutStrategyByPreset(preset);

    const row = await insertPolicyRolloutPlan({
      userId: uid,
      rolloutType: body.rolloutType ?? "blended",
      sourceScenarioId,
      name,
      scopeJson: body.scopeJson ?? null,
      rolloutStrategyJson: { ...strategyJson } as Record<string, unknown>,
      guardrailsJson: body.guardrailsJson ?? null,
      rollbackPlanJson:
        body.rollbackPlanJson ?? ({ rollbackThresholds: strategyJson.rollbackThresholds } as Record<string, unknown>),
      isSaved: true,
    });

    if (!row) {
      return NextResponse.json({ error: "Save failed" }, { status: 400 });
    }

    return NextResponse.json({ ok: true, plan: row });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
