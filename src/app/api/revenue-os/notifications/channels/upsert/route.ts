import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthedUserId } from "@/lib/api/auth";
import { logBentleyCorrelationEvent } from "@/lib/revenue-os/bentley-correlation-server";
import { upsertNotificationChannel } from "@/lib/revenue-os/notification-db";

import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
const BodySchema = z.object({
  id: z.string().max(36).optional(),
  channelType: z
    .enum(["in_app", "email_placeholder", "webhook_placeholder", "slack_placeholder", "email", "webhook"])
    .or(z.string().max(48)),
  channelLabel: z.string().max(256).optional().default(""),
  channelConfigJson: z.record(z.string(), z.unknown()).optional().nullable(),
  isEnabled: z.boolean().optional().default(true),
});

export async function POST(req: NextRequest) {
  const __rosGate = await enforceRevenueOsApiAccess(req);
  if (__rosGate) return __rosGate;
  try {
    logBentleyCorrelationEvent("revenue-os/notifications/channels/upsert", req);
    const userId = await getAuthedUserId();
    if (userId == null) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    const parsed = BodySchema.parse(await req.json().catch(() => ({})));
    const r = await upsertNotificationChannel({
      userId: String(userId),
      id: parsed.id,
      channelType: String(parsed.channelType),
      channelLabel: parsed.channelLabel,
      channelConfigJson: parsed.channelConfigJson ?? null,
      isEnabled: parsed.isEnabled,
    });
    if (!r.ok) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }
    return NextResponse.json({ ok: true, channel: r.row });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }
}
