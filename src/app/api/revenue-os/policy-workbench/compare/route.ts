import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthedUserId } from "@/lib/api/auth";
import { logBentleyCorrelationEvent } from "@/lib/revenue-os/bentley-correlation-server";
import { compareBentleyScenarios } from "@/lib/revenue-os/scenario-compare";
import {
  getPolicyScenarioByIdForUser,
  getLatestRunForScenario,
} from "@/lib/revenue-os/policy-scenarios-db";
import {
  buildRankedScenarioTable,
  buildSafestBadge,
  buildHighestUpsideBadge,
  buildBalancedRecommendationCallout,
  buildComparisonMatrixPayload,
  buildRichScenarioCompareMatrixPayload,
} from "@/lib/revenue-os/scenario-compare-ui";

import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
const BodySchema = z.object({
  scenarioIds: z.array(z.string()).optional(),
  pairedScenarioMode: z.boolean().optional(),
  recommendationPreset: z.string().optional().nullable(),
  adHoc: z
    .array(
      z.object({
        id: z.string(),
        name: z.string().optional(),
        scenarioType: z.string().optional().nullable(),
        comparisonJson: z.record(z.string(), z.unknown()).optional().nullable(),
        riskSummaryJson: z.record(z.string(), z.unknown()).optional().nullable(),
        recommendationNote: z.string().optional().nullable(),
      })
    )
    .optional(),
});

export async function POST(req: NextRequest) {
  const __rosGate = await enforceRevenueOsApiAccess(req);
  if (__rosGate) return __rosGate;
  try {
    logBentleyCorrelationEvent("revenue-os/policy-workbench/compare", req);
    const userId = await getAuthedUserId();
    const generatedAt = new Date().toISOString();
    if (userId == null) {
      return NextResponse.json({ signedOut: true, compare: null, ui: null, generatedAt });
    }
    const uid = String(userId);
    const body = BodySchema.parse(await req.json().catch(() => ({})));

    const scenarios: Array<{
      id: string;
      name?: string;
      scenarioType?: string | null;
      comparisonJson?: Record<string, unknown> | null;
      riskSummaryJson?: Record<string, unknown> | null;
      recommendationNote?: string | null;
    }> = [];

    for (const id of body.scenarioIds ?? []) {
      const sid = String(id).trim();
      if (!sid) continue;
      const s = await getPolicyScenarioByIdForUser({ userId: uid, scenarioId: sid });
      if (!s) continue;
      const latest = await getLatestRunForScenario(s.id);
      const recJson = latest?.recommendationJson as Record<string, unknown> | null | undefined;
      const topSug =
        recJson && Array.isArray(recJson.suggestions) && recJson.suggestions[0]
          ? String((recJson.suggestions[0] as { title?: string }).title ?? "")
          : "";
      scenarios.push({
        id: s.id,
        name: s.name,
        scenarioType: s.scenarioType,
        comparisonJson: (latest?.comparisonJson as Record<string, unknown> | null) ?? null,
        riskSummaryJson: (latest?.riskSummaryJson as Record<string, unknown> | null) ?? null,
        recommendationNote: topSug || null,
      });
    }

    for (const a of body.adHoc ?? []) {
      scenarios.push({
        id: a.id,
        name: a.name,
        scenarioType: a.scenarioType ?? null,
        comparisonJson: a.comparisonJson ?? null,
        riskSummaryJson: a.riskSummaryJson ?? null,
        recommendationNote: a.recommendationNote ?? null,
      });
    }

    const compare = compareBentleyScenarios({
      scenarios,
      pairedScenarioMode: body.pairedScenarioMode,
      recommendationPreset: body.recommendationPreset ?? undefined,
    });

    return NextResponse.json({
      signedOut: false,
      compare,
      ui: {
        rankedTable: buildRankedScenarioTable(compare),
        safest: buildSafestBadge(compare.safestScenario),
        highestUpside: buildHighestUpsideBadge(compare.highestUpsideScenario),
        balanced: buildBalancedRecommendationCallout(compare),
        matrix: buildComparisonMatrixPayload(compare),
        richMatrix: buildRichScenarioCompareMatrixPayload(compare),
      },
      generatedAt,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
