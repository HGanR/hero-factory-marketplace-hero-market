import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthedUserId } from "@/lib/api/auth";
import { logBentleyCorrelationEvent } from "@/lib/revenue-os/bentley-correlation-server";
import { scheduleDistributionQueueItem } from "@/lib/revenue-os/distribution-queue-actions";

import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
const BodySchema = z.object({
  clientId: z.string().max(36).optional().default(""),
  trustId: z.string().max(36).optional().default(""),
  queueId: z.string().min(1).max(36),
  scheduledFor: z.union([z.string(), z.coerce.date()]),
});

export async function POST(req: NextRequest) {
  const __rosGate = await enforceRevenueOsApiAccess(req);
  if (__rosGate) return __rosGate;
  try {
    logBentleyCorrelationEvent("revenue-os/distribution/schedule", req);
    const userId = await getAuthedUserId();
    if (userId == null) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const parsed = BodySchema.parse(await req.json().catch(() => ({})));
    const when =
      typeof parsed.scheduledFor === "string"
        ? new Date(parsed.scheduledFor)
        : parsed.scheduledFor instanceof Date
          ? parsed.scheduledFor
          : new Date();
    if (Number.isNaN(when.getTime())) {
      return NextResponse.json({ error: "Invalid scheduledFor" }, { status: 400 });
    }
    const result = await scheduleDistributionQueueItem({
      userId: String(userId),
      clientId: parsed.clientId,
      trustId: parsed.trustId,
      queueId: parsed.queueId,
      scheduledFor: when,
    });
    if (!result.ok) {
      return NextResponse.json({ ok: false, reason: result.reason }, { status: 400 });
    }
    return NextResponse.json({ ok: true, row: result.row });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
