import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthedUserId } from "@/lib/api/auth";
import { logBentleyCorrelationEvent } from "@/lib/revenue-os/bentley-correlation-server";
import { runBentleyPolicyScenario } from "@/lib/revenue-os/policy-tuning-workbench";
import {
  buildSimulationResultCards,
  buildWorkbenchBeforeAfterTable,
  buildWorkbenchRiskPanel,
  buildRecommendationCallout,
} from "@/lib/revenue-os/policy-workbench-ui";
import { buildProposedSnapshotFromPreset, isWorkbenchRecommendationPreset } from "@/lib/revenue-os/policy-workbench-presets";

import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
const BodySchema = z.object({
  dryRun: z.literal(true).optional(),
  clientId: z.string().optional(),
  trustId: z.string().optional(),
  scenarioType: z.enum(["autonomous", "cadence", "notifications", "blended"]),
  basePolicySnapshotJson: z.record(z.string(), z.unknown()).optional(),
  proposedPolicySnapshotJson: z.record(z.string(), z.unknown()).default({}),
  pairedScenarioMode: z.boolean().optional(),
  recommendationPreset: z.string().optional().nullable(),
});

export async function POST(req: NextRequest) {
  const __rosGate = await enforceRevenueOsApiAccess(req);
  if (__rosGate) return __rosGate;
  try {
    logBentleyCorrelationEvent("revenue-os/policy-workbench/simulate", req);
    const userId = await getAuthedUserId();
    const generatedAt = new Date().toISOString();
    if (userId == null) {
      return NextResponse.json({ signedOut: true, run: null, ui: null, generatedAt });
    }
    const uid = String(userId);
    const body = BodySchema.parse(await req.json().catch(() => ({})));

    let proposed: Record<string, unknown> = { ...body.proposedPolicySnapshotJson };
    if (body.recommendationPreset && isWorkbenchRecommendationPreset(body.recommendationPreset)) {
      proposed = { ...buildProposedSnapshotFromPreset(body.recommendationPreset), ...proposed };
    }

    const run = await runBentleyPolicyScenario({
      userId: uid,
      clientId: body.clientId,
      trustId: body.trustId,
      scenarioType: body.scenarioType,
      proposedPolicySnapshotJson: proposed,
      basePolicySnapshotJson: body.basePolicySnapshotJson,
    });

    return NextResponse.json({
      signedOut: false,
      dryRun: true,
      pairedScenarioMode: Boolean(body.pairedScenarioMode),
      recommendationPreset: body.recommendationPreset ?? null,
      run,
      ui: {
        cards: buildSimulationResultCards(run),
        table: buildWorkbenchBeforeAfterTable(run),
        risk: buildWorkbenchRiskPanel(run),
        recommendation: buildRecommendationCallout(run),
      },
      generatedAt,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
