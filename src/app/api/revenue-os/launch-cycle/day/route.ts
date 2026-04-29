import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthedUserId } from "@/lib/api/auth";
import { logBentleyCorrelationEvent } from "@/lib/revenue-os/bentley-correlation-server";
import { saveLaunchDayProgressForUser } from "@/lib/revenue-os/launch-progress-db";

import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
const PatchSchema = z.object({
  scopeKey: z.string().min(1).max(200).optional(),
  clientId: z.string().max(36).optional(),
  trustId: z.string().max(36).optional(),
  cycleId: z.string().min(1).max(36),
  day: z.number().int().min(1).max(7),
  status: z.enum(["not_started", "in_progress", "completed", "blocked"]).optional(),
  completedActions: z.array(z.string()).optional(),
  notes: z.string().optional(),
  lastActionAt: z.string().optional(),
});

export async function PATCH(req: NextRequest) {
  const __rosGate = await enforceRevenueOsApiAccess(req);
  if (__rosGate) return __rosGate;
  try {
    logBentleyCorrelationEvent("revenue-os/launch-cycle/day", req);
    const userId = await getAuthedUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const body = PatchSchema.parse(await req.json());
    const ok = await saveLaunchDayProgressForUser(String(userId), body.cycleId, body.day as 1 | 2 | 3 | 4 | 5 | 6 | 7, {
      ...(body.status !== undefined ? { status: body.status } : {}),
      ...(body.completedActions !== undefined ? { completedActions: body.completedActions } : {}),
      ...(body.notes !== undefined ? { notes: body.notes } : {}),
      ...(body.lastActionAt !== undefined ? { lastActionAt: body.lastActionAt } : {}),
    });
    if (!ok) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid body", details: e.flatten() }, { status: 400 });
    }
    console.error("[revenue-os/launch-cycle/day PATCH]", e);
    return NextResponse.json({ error: "Failed to update day" }, { status: 500 });
  }
}
