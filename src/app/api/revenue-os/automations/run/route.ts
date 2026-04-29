import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthedUserId } from "@/lib/api/auth";
import { logBentleyCorrelationEvent } from "@/lib/revenue-os/bentley-correlation-server";
import { runBentleyAutomationPolicy, runBentleyAutomationSweep } from "@/lib/revenue-os/automation-engine";

import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
const BodySchema = z.object({
  dryRun: z.boolean().optional().default(false),
  policyId: z.string().max(36).optional(),
  clientId: z.string().max(36).optional().default(""),
  trustId: z.string().max(36).optional().default(""),
  /** Omitted = run now for single policy; sweep defaults to schedule-respecting. */
  force: z.boolean().optional(),
  sweep: z.boolean().optional().default(false),
});

export async function POST(req: NextRequest) {
  const __rosGate = await enforceRevenueOsApiAccess(req);
  if (__rosGate) return __rosGate;
  try {
    logBentleyCorrelationEvent("revenue-os/automations/run", req);
    const userId = await getAuthedUserId();
    if (userId == null) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    const parsed = BodySchema.parse(await req.json().catch(() => ({})));
    const uid = String(userId);

    if (parsed.policyId?.trim()) {
      const r = await runBentleyAutomationPolicy({
        userId: uid,
        policyId: parsed.policyId.trim(),
        dryRun: parsed.dryRun,
        force: parsed.force ?? true,
      });
      return NextResponse.json({ ok: r.ok, dryRun: parsed.dryRun, result: r });
    }

    if (parsed.sweep) {
      const sweep = await runBentleyAutomationSweep({
        userId: uid,
        clientId: parsed.clientId || undefined,
        trustId: parsed.trustId || undefined,
        dryRun: parsed.dryRun,
        force: parsed.force ?? false,
      });
      return NextResponse.json({ ok: true, dryRun: parsed.dryRun, sweep });
    }

    const sweep = await runBentleyAutomationSweep({
      userId: uid,
      clientId: parsed.clientId || undefined,
      trustId: parsed.trustId || undefined,
      dryRun: parsed.dryRun,
      force: parsed.force ?? false,
    });
    return NextResponse.json({ ok: true, dryRun: parsed.dryRun, sweep });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }
}
