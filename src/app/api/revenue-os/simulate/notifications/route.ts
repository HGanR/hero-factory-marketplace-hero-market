import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthedUserId } from "@/lib/api/auth";
import { logBentleyCorrelationEvent } from "@/lib/revenue-os/bentley-correlation-server";
import { buildBentleyOperatorOverview } from "@/lib/revenue-os/operator-intelligence";
import { simulateBentleyNotificationPolicies } from "@/lib/revenue-os/policy-simulation";
import { compareBentleySimulationAgainstCurrent } from "@/lib/revenue-os/simulation-comparator";
import { buildSimulationComparisonTablePayload, buildPolicyDeltaRiskPanel } from "@/lib/revenue-os/simulation-ui";

import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
const BodySchema = z.object({
  dryRun: z.literal(true).optional(),
  clientId: z.string().optional(),
  trustId: z.string().optional(),
  minSeverityProposed: z.enum(["info", "warning", "critical"]),
});

export async function POST(req: NextRequest) {
  const __rosGate = await enforceRevenueOsApiAccess(req);
  if (__rosGate) return __rosGate;
  try {
    logBentleyCorrelationEvent("revenue-os/simulate/notifications", req);
    const userId = await getAuthedUserId();
    const generatedAt = new Date().toISOString();
    if (userId == null) {
      return NextResponse.json({ signedOut: true, simulation: null, generatedAt });
    }
    const uid = String(userId);

    const body = BodySchema.parse(await req.json());
    const overview = await buildBentleyOperatorOverview({
      userId: uid,
      clientIds: body.clientId ? [body.clientId] : undefined,
      trustIds: body.trustId ? [body.trustId] : undefined,
    });

    const simulation = simulateBentleyNotificationPolicies({
      userId: uid,
      overview,
      minSeverityProposed: body.minSeverityProposed,
    });

    const comparison = compareBentleySimulationAgainstCurrent({
      notificationEventsDelta: simulation.eventsProposed - simulation.eventsCurrent,
    });
    const table = buildSimulationComparisonTablePayload({ notifications: simulation });
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
