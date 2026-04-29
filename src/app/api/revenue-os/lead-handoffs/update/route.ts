import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthedUserId } from "@/lib/api/auth";
import { logBentleyCorrelationEvent } from "@/lib/revenue-os/bentley-correlation-server";
import { updateLeadHandoffStatus } from "@/lib/revenue-os/lead-handoff";

import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
const BodySchema = z.object({
  clientId: z.string().max(36).optional().default(""),
  trustId: z.string().max(36).optional().default(""),
  handoffId: z.string().min(1).max(36),
  status: z.enum(["new", "reviewed", "routed", "contacted", "closed", "archived"]),
  ownerUserId: z.string().max(64).optional().nullable(),
  handoffNote: z.string().max(8000).optional().nullable(),
});

export async function POST(req: NextRequest) {
  const __rosGate = await enforceRevenueOsApiAccess(req);
  if (__rosGate) return __rosGate;
  try {
    logBentleyCorrelationEvent("revenue-os/lead-handoffs/update", req);
    const userId = await getAuthedUserId();
    if (userId == null) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const parsed = BodySchema.parse(await req.json().catch(() => ({})));
    const ok = await updateLeadHandoffStatus({
      userId: String(userId),
      clientId: parsed.clientId,
      trustId: parsed.trustId,
      handoffId: parsed.handoffId,
      status: parsed.status,
      ownerUserId: parsed.ownerUserId,
      handoffNote: parsed.handoffNote,
    });
    if (!ok) return NextResponse.json({ error: "Update failed" }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
