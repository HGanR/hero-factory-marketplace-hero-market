import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthedUserId } from "@/lib/api/auth";
import { logBentleyCorrelationEvent } from "@/lib/revenue-os/bentley-correlation-server";
import { toggleNotificationChannel } from "@/lib/revenue-os/notification-db";

import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
const BodySchema = z.object({
  channelId: z.string().min(1).max(36),
  isEnabled: z.boolean(),
});

export async function POST(req: NextRequest) {
  const __rosGate = await enforceRevenueOsApiAccess(req);
  if (__rosGate) return __rosGate;
  try {
    logBentleyCorrelationEvent("revenue-os/notifications/channels/toggle", req);
    const userId = await getAuthedUserId();
    if (userId == null) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    const parsed = BodySchema.parse(await req.json().catch(() => ({})));
    const r = await toggleNotificationChannel({
      userId: String(userId),
      channelId: parsed.channelId,
      isEnabled: parsed.isEnabled,
    });
    return NextResponse.json({ ok: r.ok });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }
}
