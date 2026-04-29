import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthedUserId } from "@/lib/api/auth";
import { logBentleyCorrelationEvent } from "@/lib/revenue-os/bentley-correlation-server";
import { upsertNotificationPolicy } from "@/lib/revenue-os/notification-db";

import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
const BodySchema = z.object({
  id: z.string().max(36).optional(),
  clientId: z.string().max(36).optional().default(""),
  trustId: z.string().max(36).optional().default(""),
  eventType: z.string().min(1).max(96),
  minimumSeverity: z.enum(["info", "warning", "critical"]),
  channelId: z.string().min(1).max(36),
  isEnabled: z.boolean().optional().default(true),
  policyConfigJson: z.record(z.string(), z.unknown()).optional().nullable(),
});

export async function POST(req: NextRequest) {
  const __rosGate = await enforceRevenueOsApiAccess(req);
  if (__rosGate) return __rosGate;
  try {
    logBentleyCorrelationEvent("revenue-os/notifications/policies/upsert", req);
    const userId = await getAuthedUserId();
    if (userId == null) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    const parsed = BodySchema.parse(await req.json().catch(() => ({})));
    const r = await upsertNotificationPolicy({
      userId: String(userId),
      id: parsed.id,
      clientId: parsed.clientId,
      trustId: parsed.trustId,
      eventType: parsed.eventType,
      minimumSeverity: parsed.minimumSeverity,
      channelId: parsed.channelId,
      isEnabled: parsed.isEnabled,
      policyConfigJson: parsed.policyConfigJson ?? null,
    });
    if (!r.ok) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }
    return NextResponse.json({ ok: true, policy: r.row });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }
}
