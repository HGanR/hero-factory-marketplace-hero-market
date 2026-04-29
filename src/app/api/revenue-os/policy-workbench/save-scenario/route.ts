import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthedUserId } from "@/lib/api/auth";
import { logBentleyCorrelationEvent } from "@/lib/revenue-os/bentley-correlation-server";
import { runBentleyPolicyScenario } from "@/lib/revenue-os/policy-tuning-workbench";
import {
  insertPolicyScenario,
  insertPolicyScenarioRun,
  type BentleyPolicyScenarioType,
} from "@/lib/revenue-os/policy-scenarios-db";

import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
const BodySchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
  clientId: z.string().optional(),
  trustId: z.string().optional(),
  scenarioType: z.enum(["autonomous", "cadence", "notifications", "blended"]),
  basePolicySnapshotJson: z.record(z.string(), z.unknown()).optional().nullable(),
  proposedPolicySnapshotJson: z.record(z.string(), z.unknown()).default({}),
});

export async function POST(req: NextRequest) {
  const __rosGate = await enforceRevenueOsApiAccess(req);
  if (__rosGate) return __rosGate;
  try {
    logBentleyCorrelationEvent("revenue-os/policy-workbench/save-scenario", req);
    const userId = await getAuthedUserId();
    const generatedAt = new Date().toISOString();
    if (userId == null) {
      return NextResponse.json({ ok: false, signedOut: true, scenario: null, run: null, generatedAt }, { status: 401 });
    }
    const uid = String(userId);
    const body = BodySchema.parse(await req.json().catch(() => ({})));

    const run = await runBentleyPolicyScenario({
      userId: uid,
      clientId: body.clientId,
      trustId: body.trustId,
      scenarioType: body.scenarioType as BentleyPolicyScenarioType,
      proposedPolicySnapshotJson: body.proposedPolicySnapshotJson,
      basePolicySnapshotJson: body.basePolicySnapshotJson ?? undefined,
    });

    const scenario = await insertPolicyScenario({
      userId: uid,
      clientId: body.clientId ?? null,
      trustId: body.trustId ?? null,
      scenarioType: body.scenarioType as BentleyPolicyScenarioType,
      name: body.name,
      description: body.description ?? null,
      basePolicySnapshotJson: body.basePolicySnapshotJson ?? null,
      proposedPolicySnapshotJson: body.proposedPolicySnapshotJson,
      isSaved: true,
    });

    if (!scenario) {
      return NextResponse.json({ ok: false, error: "persist_failed" }, { status: 400 });
    }

    const runStatus = run.partialReasons.length ? ("partial" as const) : ("completed" as const);
    const runRow = await insertPolicyScenarioRun({
      scenarioId: scenario.id,
      runStatus,
      comparisonJson: { ...run.comparison } as unknown as Record<string, unknown>,
      riskSummaryJson: {
        lines: run.riskSummary.lines,
        riskFlags: run.riskSummary.riskFlags,
      },
      recommendationJson: {
        recommendation: run.recommendation,
        suggestions: run.recommendations.slice(0, 3),
      },
    });

    return NextResponse.json({
      ok: true,
      signedOut: false,
      scenario,
      run: runRow,
      simulation: run,
      generatedAt,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }
}
