import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthedUserId } from "@/lib/api/auth";
import { logBentleyCorrelationEvent } from "@/lib/revenue-os/bentley-correlation-server";
import { fetchDistributionQueueState } from "@/lib/revenue-os/distribution-queue-actions";
import { simulateBentleyCadencePolicies } from "@/lib/revenue-os/policy-simulation";
import { compareBentleySimulationAgainstCurrent } from "@/lib/revenue-os/simulation-comparator";
import { buildSimulationComparisonTablePayload, buildPolicyDeltaRiskPanel } from "@/lib/revenue-os/simulation-ui";

import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
const BodySchema = z.object({
  dryRun: z.literal(true).optional(),
  clientId: z.string(),
  trustId: z.string(),
  staleDaysCurrent: z.number().optional(),
  staleDaysProposed: z.number().optional(),
  promotedWinnersSkippingApproval: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  const __rosGate = await enforceRevenueOsApiAccess(req);
  if (__rosGate) return __rosGate;
  try {
    logBentleyCorrelationEvent("revenue-os/simulate/cadence", req);
    const userId = await getAuthedUserId();
    const generatedAt = new Date().toISOString();
    if (userId == null) {
      return NextResponse.json({ signedOut: true, simulation: null, generatedAt });
    }
    const uid = String(userId);

    const body = BodySchema.parse(await req.json());
    const queueItems = await fetchDistributionQueueState({
      userId: uid,
      clientId: body.clientId,
      trustId: body.trustId,
      limit: 200,
    });

    const simulation = simulateBentleyCadencePolicies({
      queueItems,
      staleDaysCurrent: body.staleDaysCurrent,
      staleDaysProposed: body.staleDaysProposed,
      promotedWinnersSkippingApproval: body.promotedWinnersSkippingApproval,
    });

    const delta = simulation.staleDraftsEligibleProposed - simulation.staleDraftsEligibleCurrent;
    const comparison = compareBentleySimulationAgainstCurrent({
      queueStateDelta: delta,
    });
    const table = buildSimulationComparisonTablePayload({ cadence: simulation });
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
