import { NextRequest, NextResponse } from "next/server";
import { getAuthedUserId } from "@/lib/api/auth";
import { logBentleyCorrelationEvent } from "@/lib/revenue-os/bentley-correlation-server";
import { buildBentleyOperatorOverview } from "@/lib/revenue-os/operator-intelligence";
import { buildBentleyRolloutCoaching } from "@/lib/revenue-os/rollout-coaching";
import { compareBentleyScenarios } from "@/lib/revenue-os/scenario-compare";
import { listPolicyScenariosForUser, getLatestRunForScenario } from "@/lib/revenue-os/policy-scenarios-db";
import {
  buildRolloutStageCards,
  buildPilotWorkspaceTable,
  buildAvoidWorkspaceTable,
  buildRolloutSummaryBanner,
  buildSuccessMetricChecklist,
  buildOperatorWarningBanners,
} from "@/lib/revenue-os/rollout-ui";
import {
  buildRolloutRiskSummaryCards,
  buildRollbackTriggerList,
} from "@/lib/revenue-os/rollout-risk-ui";
import type { RolloutStrategyPreset } from "@/lib/revenue-os/rollout-strategies";

import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
export async function GET(req: NextRequest) {
  const __rosGate = await enforceRevenueOsApiAccess(req);
  if (__rosGate) return __rosGate;
  try {
    logBentleyCorrelationEvent("revenue-os/policy-rollout/current", req);
    const sp = req.nextUrl.searchParams;
    const clientId = sp.get("clientId")?.trim() || undefined;
    const trustId = sp.get("trustId")?.trim() || undefined;
    const strategyPreset = (sp.get("strategyPreset")?.trim() || "balanced") as RolloutStrategyPreset;
    const userId = await getAuthedUserId();
    const generatedAt = new Date().toISOString();

    if (userId == null) {
      return NextResponse.json({ signedOut: true, coaching: null, ui: null, generatedAt });
    }

    const uid = String(userId);
    const overview = await buildBentleyOperatorOverview({
      userId: uid,
      clientIds: clientId ? [clientId] : undefined,
      trustIds: trustId ? [trustId] : undefined,
    });

    const scenarios = await listPolicyScenariosForUser({
      userId: uid,
      clientId,
      trustId,
      limit: 8,
      savedOnly: true,
    });
    const compareRows = await Promise.all(
      scenarios.slice(0, 5).map(async (row) => {
        const latest = await getLatestRunForScenario(row.id);
        return {
          id: row.id,
          name: row.name,
          scenarioType: String(row.scenarioType ?? "blended"),
          comparisonJson: (latest?.comparisonJson ?? null) as Record<string, unknown> | null,
          riskSummaryJson: (latest?.riskSummaryJson ?? null) as Record<string, unknown> | null,
        };
      })
    );
    const scenarioCompare =
      compareRows.filter((r) => r.comparisonJson && typeof r.comparisonJson === "object").length >= 2
        ? compareBentleyScenarios({ scenarios: compareRows })
        : null;

    const coaching = buildBentleyRolloutCoaching({
      overview,
      scenarioCompare,
      strategyPreset,
    });

    const ui = {
      summary: buildRolloutSummaryBanner(coaching),
      stages: buildRolloutStageCards(coaching),
      pilots: buildPilotWorkspaceTable(coaching),
      avoid: buildAvoidWorkspaceTable(coaching),
      successChecklist: buildSuccessMetricChecklist(coaching),
      warnings: buildOperatorWarningBanners(coaching),
      riskCards: buildRolloutRiskSummaryCards(coaching),
      rollbackList: buildRollbackTriggerList(coaching),
    };

    return NextResponse.json({
      signedOut: false,
      generatedAt,
      coaching,
      scenarioIds: scenarios.map((s) => ({ id: s.id, name: s.name })),
      ui,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
