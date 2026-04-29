import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthedUserId } from "@/lib/api/auth";
import { logBentleyCorrelationEvent } from "@/lib/revenue-os/bentley-correlation-server";
import { dispatchBentleyOperatorAction, type OperatorRunActionType } from "@/lib/revenue-os/operator-run-dispatch";

import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
const BodySchema = z.object({
  actionType: z.enum([
    "approve_queue_item",
    "retry_publish",
    "archive_queue_item",
    "run_cadence",
    "create_lead_handoff",
    "sync_performance",
    "schedule_queue_item",
  ]),
  clientId: z.string().max(36).optional().default(""),
  trustId: z.string().max(36).optional().default(""),
  queueId: z.string().max(36).optional(),
  queueTargetId: z.string().max(36).optional().nullable(),
  leadSignalId: z.string().max(36).optional(),
  scheduledFor: z.string().optional(),
  dryRun: z.boolean().optional().default(false),
  runType: z
    .enum(["daily_refresh", "winner_promotion", "retry_failed", "stale_cleanup", "retest_planning"])
    .optional(),
  mockOrManual: z.boolean().optional(),
  manualOverride: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  const __rosGate = await enforceRevenueOsApiAccess(req);
  if (__rosGate) return __rosGate;
  try {
    logBentleyCorrelationEvent("revenue-os/operator/run-action", req);
    const userId = await getAuthedUserId();
    if (userId == null) {
      return NextResponse.json({ ok: false, reason: "unauthorized" }, { status: 401 });
    }
    const parsed = BodySchema.parse(await req.json().catch(() => ({})));
    const uid = String(userId);

    const result = await dispatchBentleyOperatorAction({
      userId: uid,
      actionType: parsed.actionType as OperatorRunActionType,
      clientId: parsed.clientId,
      trustId: parsed.trustId,
      queueId: parsed.queueId,
      queueTargetId: parsed.queueTargetId,
      leadSignalId: parsed.leadSignalId,
      scheduledFor: parsed.scheduledFor,
      dryRun: parsed.dryRun,
      runType: parsed.runType,
      mockOrManual: parsed.mockOrManual,
      manualOverride: parsed.manualOverride,
    });

    const status = result.ok ? 200 : 400;
    return NextResponse.json(
      {
        ok: result.ok,
        reason: result.reason,
        dryRun: result.dryRun,
        details: result.details,
      },
      { status }
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, reason: "bad_request", error: msg }, { status: 400 });
  }
}
