import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthedUserId } from "@/lib/api/auth";
import { executeBentleyCadenceRun } from "@/lib/revenue-os/execute-cadence-run";

import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
const BodySchema = z.object({
  clientId: z.string().max(36).optional().default(""),
  trustId: z.string().max(36).optional().default(""),
  runType: z
    .enum(["daily_refresh", "winner_promotion", "retry_failed", "stale_cleanup", "retest_planning"])
    .optional()
    .default("daily_refresh"),
  dryRun: z.boolean().optional().default(false),
});

export async function POST(req: NextRequest) {
  const __rosGate = await enforceRevenueOsApiAccess(req);
  if (__rosGate) return __rosGate;
  try {
    const userId = await getAuthedUserId();
    if (userId == null) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const parsed = BodySchema.parse(await req.json().catch(() => ({})));
    const uid = String(userId);
    const { clientId, trustId } = parsed;

    const result = await executeBentleyCadenceRun({
      userId: uid,
      clientId,
      trustId,
      runType: parsed.runType,
      dryRun: parsed.dryRun,
    });

    return NextResponse.json({
      ok: true,
      dryRun: parsed.dryRun,
      cadenceRunId: result.cadenceRunId,
      runPersisted: result.runPersisted,
      queueUpdates: result.queueUpdates,
      plan: result.plan,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
