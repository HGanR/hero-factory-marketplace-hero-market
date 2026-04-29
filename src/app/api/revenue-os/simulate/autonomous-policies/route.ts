import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthedUserId } from "@/lib/api/auth";
import { logBentleyCorrelationEvent } from "@/lib/revenue-os/bentley-correlation-server";
import { listAutonomousPoliciesForUser } from "@/lib/revenue-os/autonomous-policies-db";
import type { BentleyAutonomousCandidate } from "@/lib/revenue-os/autonomous-candidates";
import type { EvaluateBentleyAutonomousThresholdsInput } from "@/lib/revenue-os/autonomous-thresholds";
import { simulateBentleyAutonomousPolicies, type AutonomousPolicyPatch } from "@/lib/revenue-os/policy-simulation";
import { compareBentleySimulationAgainstCurrent } from "@/lib/revenue-os/simulation-comparator";
import { buildSimulationComparisonTablePayload, buildPolicyDeltaRiskPanel } from "@/lib/revenue-os/simulation-ui";

import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
const BodySchema = z.object({
  dryRun: z.literal(true).optional(),
  clientId: z.string().optional(),
  trustId: z.string().optional(),
  policyPatchesById: z.record(z.string(), z.record(z.string(), z.unknown())).default({}),
  pairs: z.array(
    z.object({
      candidate: z.object({
        actionType: z.string(),
        scope: z.object({ clientId: z.string(), trustId: z.string() }),
        reason: z.string().optional(),
        riskLevel: z.enum(["low", "medium", "high", "critical"]),
        confidence: z.number(),
        sourceSystem: z.string().optional(),
        targetIds: z.array(z.string()),
        estimatedImpact: z.string().optional(),
        queueId: z.string().optional(),
      }),
      context: z.object({
        hasOpenBlockingIssue: z.boolean(),
        connectorReady: z.boolean(),
        recentFailuresForTarget: z.number(),
        executionsToday: z.number(),
        policyCooldownActive: z.boolean(),
        workspacePriorityRank: z.number().optional(),
      }),
    })
  ),
});

export async function POST(req: NextRequest) {
  const __rosGate = await enforceRevenueOsApiAccess(req);
  if (__rosGate) return __rosGate;
  try {
    logBentleyCorrelationEvent("revenue-os/simulate/autonomous-policies", req);
    const userId = await getAuthedUserId();
    const generatedAt = new Date().toISOString();
    if (userId == null) {
      return NextResponse.json({ signedOut: true, simulation: null, generatedAt });
    }
    const uid = String(userId);

    const body = BodySchema.parse(await req.json().catch(() => ({})));
    const policiesCurrent = await listAutonomousPoliciesForUser({
      userId: uid,
      clientId: body.clientId,
      trustId: body.trustId,
    });

    const candidates: BentleyAutonomousCandidate[] = body.pairs.map((p) => ({
      actionType: p.candidate.actionType as BentleyAutonomousCandidate["actionType"],
      scope: p.candidate.scope,
      reason: p.candidate.reason ?? "",
      riskLevel: p.candidate.riskLevel,
      confidence: p.candidate.confidence,
      sourceSystem: p.candidate.sourceSystem ?? "simulation",
      targetIds: p.candidate.targetIds,
      estimatedImpact: p.candidate.estimatedImpact ?? "",
      queueId: p.candidate.queueId,
    }));

    const contextByCandidateIndex: EvaluateBentleyAutonomousThresholdsInput["context"][] = body.pairs.map(
      (p) => p.context
    );

    const patches: Record<string, AutonomousPolicyPatch> = {};
    for (const [id, raw] of Object.entries(body.policyPatchesById)) {
      patches[id] = raw as AutonomousPolicyPatch;
    }

    const simulation = simulateBentleyAutonomousPolicies({
      candidates,
      policiesCurrent,
      policyPatchesById: patches,
      contextByCandidateIndex,
    });

    const comparison = compareBentleySimulationAgainstCurrent({ autonomous: simulation });
    const table = buildSimulationComparisonTablePayload({ autonomous: simulation });
    const risk = buildPolicyDeltaRiskPanel({ comparison, autonomousRiskFlags: simulation.riskFlags });

    return NextResponse.json({
      signedOut: false,
      dryRun: true,
      simulation,
      comparison,
      ui: { table, risk },
      generatedAt,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
