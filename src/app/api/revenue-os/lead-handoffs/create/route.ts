import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthedUserId } from "@/lib/api/auth";
import { logBentleyCorrelationEvent } from "@/lib/revenue-os/bentley-correlation-server";
import { createLeadHandoff } from "@/lib/revenue-os/lead-handoff";

import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
const BodySchema = z.object({
  clientId: z.string().max(36).optional().default(""),
  trustId: z.string().max(36).optional().default(""),
  leadSignalId: z.string().min(1).max(36),
  recommendedFollowup: z.string().max(512).optional().nullable(),
  bentleyNextResponseMode: z.string().max(128).optional().nullable(),
  handoffNote: z.string().max(8000).optional().nullable(),
  handoffReadinessThreshold: z.number().min(0).max(1).optional(),
});

export async function POST(req: NextRequest) {
  const __rosGate = await enforceRevenueOsApiAccess(req);
  if (__rosGate) return __rosGate;
  try {
    logBentleyCorrelationEvent("revenue-os/lead-handoffs/create", req);
    const userId = await getAuthedUserId();
    if (userId == null) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const parsed = BodySchema.parse(await req.json().catch(() => ({})));
    const row = await createLeadHandoff({
      userId: String(userId),
      clientId: parsed.clientId,
      trustId: parsed.trustId,
      leadSignalId: parsed.leadSignalId,
      recommendedFollowup: parsed.recommendedFollowup ?? undefined,
      bentleyNextResponseMode: parsed.bentleyNextResponseMode,
      handoffNote: parsed.handoffNote,
      handoffReadinessThreshold: parsed.handoffReadinessThreshold,
    });
    if (!row) {
      return NextResponse.json({ error: "Could not create handoff (threshold, duplicate, or missing signal)" }, { status: 400 });
    }
    return NextResponse.json({ ok: true, id: row.id });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
