import { NextRequest, NextResponse } from "next/server";
import { getAuthedUserId } from "@/lib/api/auth";
import { logBentleyCorrelationEvent } from "@/lib/revenue-os/bentley-correlation-server";
import { buildBentleyPolicyWorkbench } from "@/lib/revenue-os/policy-tuning-workbench";
import {
  buildCurrentPolicySummaryCards,
  buildEditablePolicyGroups,
} from "@/lib/revenue-os/policy-workbench-ui";
import { buildGuidedScenarioPairs } from "@/lib/revenue-os/policy-workbench-guided";
import { WORKBENCH_PRESET_IDS, describeWorkbenchPreset } from "@/lib/revenue-os/policy-workbench-presets";
import {
  buildPolicyWorkbenchGuidanceLines,
  mergePolicyWorkbenchGuidanceIntoGrowthGuidance,
} from "@/lib/revenue-os/policy-workbench-guidance";

import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
export async function GET(req: NextRequest) {
  const __rosGate = await enforceRevenueOsApiAccess(req);
  if (__rosGate) return __rosGate;
  try {
    logBentleyCorrelationEvent("revenue-os/policy-workbench/current", req);
    const sp = req.nextUrl.searchParams;
    const clientId = sp.get("clientId")?.trim() || undefined;
    const trustId = sp.get("trustId")?.trim() || undefined;
    const userId = await getAuthedUserId();
    const generatedAt = new Date().toISOString();

    if (userId == null) {
      return NextResponse.json({
        signedOut: true,
        workbench: null,
        ui: null,
        generatedAt,
      });
    }

    const uid = String(userId);
    const workbench = await buildBentleyPolicyWorkbench({
      userId: uid,
      clientId,
      trustId,
    });
    const cards = buildCurrentPolicySummaryCards(workbench);
    const groups = buildEditablePolicyGroups();
    const guidedPairs = buildGuidedScenarioPairs({ clientId, trustId });
    const recommendationPresets = WORKBENCH_PRESET_IDS.map((id) => ({
      id,
      ...describeWorkbenchPreset(id),
    }));

    const pwLines = await buildPolicyWorkbenchGuidanceLines({
      userId: uid,
      clientId,
      trustId,
    });
    const growthGuidance = mergePolicyWorkbenchGuidanceIntoGrowthGuidance(null, pwLines);

    return NextResponse.json({
      signedOut: false,
      workbench,
      ui: {
        ...cards,
        editableGroups: groups,
        guidedPairs,
        recommendationPresets,
        growthGuidance,
      },
      generatedAt,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
