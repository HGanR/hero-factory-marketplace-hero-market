import { NextRequest, NextResponse } from "next/server";
import { getAuthedUserId } from "@/lib/api/auth";
import { logBentleyCorrelationEvent } from "@/lib/revenue-os/bentley-correlation-server";
import { buildBentleyOperatorOverview } from "@/lib/revenue-os/operator-intelligence";
import { simulateBentleyRolloutPlan } from "@/lib/revenue-os/rollout-simulation";
import { buildSimulatedStageCards, buildRolloutSimulationSummary } from "@/lib/revenue-os/rollout-ui";
import type { RolloutStrategyPreset } from "@/lib/revenue-os/rollout-strategies";
import type { BentleyRolloutStrategyJson } from "@/lib/revenue-os/rollout-strategies";

import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
export async function POST(req: NextRequest) {
  const __rosGate = await enforceRevenueOsApiAccess(req);
  if (__rosGate) return __rosGate;
  try {
    logBentleyCorrelationEvent("revenue-os/policy-rollout/simulate", req);
    const userId = await getAuthedUserId();
    if (userId == null) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as {
      clientId?: string;
      trustId?: string;
      strategyPreset?: RolloutStrategyPreset;
      strategyJson?: BentleyRolloutStrategyJson | null;
    };

    const uid = String(userId);
    const clientId = body.clientId?.trim() || undefined;
    const trustId = body.trustId?.trim() || undefined;

    const overview = await buildBentleyOperatorOverview({
      userId: uid,
      clientIds: clientId ? [clientId] : undefined,
      trustIds: trustId ? [trustId] : undefined,
    });

    const simulation = simulateBentleyRolloutPlan({
      workspaceSummaries: overview.workspaceSummaries,
      strategyPreset: body.strategyPreset,
      strategyJson: body.strategyJson ?? null,
    });

    return NextResponse.json({
      dryRun: true,
      simulation,
      ui: {
        stages: buildSimulatedStageCards(simulation),
        summary: buildRolloutSimulationSummary(simulation),
      },
      generatedAt: new Date().toISOString(),
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
