import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthedUserId } from "@/lib/api/auth";
import { logBentleyCorrelationEvent } from "@/lib/revenue-os/bentley-correlation-server";
import { appendLaunchCycleEventForUser } from "@/lib/revenue-os/launch-progress-db";

import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
const PostSchema = z.object({
  scopeKey: z.string().min(1).max(200).optional(),
  clientId: z.string().max(36).optional(),
  trustId: z.string().max(36).optional(),
  cycleId: z.string().min(1).max(36),
  eventType: z.string().min(1).max(64),
  dayNumber: z.number().int().min(1).max(7).nullable().optional(),
  eventPayload: z.record(z.string(), z.unknown()).nullable().optional(),
});

export async function POST(req: NextRequest) {
  const __rosGate = await enforceRevenueOsApiAccess(req);
  if (__rosGate) return __rosGate;
  try {
    logBentleyCorrelationEvent("revenue-os/launch-cycle/event", req);
    const userId = await getAuthedUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const body = PostSchema.parse(await req.json());
    const ok = await appendLaunchCycleEventForUser(String(userId), body.cycleId, {
      eventType: body.eventType,
      dayNumber: body.dayNumber ?? null,
      payload: body.eventPayload ?? null,
    });
    if (!ok) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid body", details: e.flatten() }, { status: 400 });
    }
    console.error("[revenue-os/launch-cycle/event POST]", e);
    return NextResponse.json({ error: "Failed to append event" }, { status: 500 });
  }
}
