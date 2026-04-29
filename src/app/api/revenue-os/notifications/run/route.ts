import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthedUserId } from "@/lib/api/auth";
import { logBentleyCorrelationEvent } from "@/lib/revenue-os/bentley-correlation-server";
import { runBentleyNotificationEngine } from "@/lib/revenue-os/notification-engine";

import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
const BodySchema = z.object({
  dryRun: z.boolean().optional().default(false),
  clientId: z.string().max(36).optional().default(""),
  trustId: z.string().max(36).optional().default(""),
  force: z.boolean().optional(),
  skipIfQuiet: z.boolean().optional().default(true),
  reportHints: z
    .object({
      dailyOperatorReportReady: z.boolean().optional(),
      weeklyExecutiveReportReady: z.boolean().optional(),
    })
    .optional(),
  digestHeadline: z.string().max(2000).optional().nullable(),
});

export async function POST(req: NextRequest) {
  const __rosGate = await enforceRevenueOsApiAccess(req);
  if (__rosGate) return __rosGate;
  try {
    logBentleyCorrelationEvent("revenue-os/notifications/run", req);
    const userId = await getAuthedUserId();
    if (userId == null) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    const parsed = BodySchema.parse(await req.json().catch(() => ({})));
    const summary = await runBentleyNotificationEngine({
      userId: String(userId),
      clientId: parsed.clientId || undefined,
      trustId: parsed.trustId || undefined,
      dryRun: parsed.dryRun,
      force: parsed.force ?? false,
      skipIfQuiet: parsed.skipIfQuiet,
      reportHints: parsed.reportHints ?? undefined,
      digestHeadline: parsed.digestHeadline ?? undefined,
    });
    return NextResponse.json({ ok: summary.ok, summary, error: summary.error });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }
}
