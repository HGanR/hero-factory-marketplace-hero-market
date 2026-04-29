import { NextRequest, NextResponse } from "next/server";
import { getAuthedUserId } from "@/lib/api/auth";
import { logBentleyCorrelationEvent } from "@/lib/revenue-os/bentley-correlation-server";
import { listNotificationEventsForUser } from "@/lib/revenue-os/notification-db";

import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
export async function GET(req: NextRequest) {
  const __rosGate = await enforceRevenueOsApiAccess(req);
  if (__rosGate) return __rosGate;
  try {
    logBentleyCorrelationEvent("revenue-os/notifications/events", req);
    const userId = await getAuthedUserId();
    if (userId == null) {
      return NextResponse.json({ ok: true, events: [], signedOut: true });
    }
    const sp = req.nextUrl.searchParams;
    const limit = Math.min(200, Math.max(1, Number(sp.get("limit")) || 80));
    const clientId = sp.get("clientId")?.trim() || undefined;
    const trustId = sp.get("trustId")?.trim() || undefined;
    const rows = await listNotificationEventsForUser({
      userId: String(userId),
      limit,
      clientId,
      trustId,
    });
    return NextResponse.json({
      ok: true,
      events: rows.map((e) => ({
        id: e.id,
        clientId: e.clientId,
        trustId: e.trustId,
        sourceType: e.sourceType,
        eventType: e.eventType,
        severity: e.severity,
        title: e.title,
        body: e.body,
        eventPayloadJson: e.eventPayloadJson,
        dedupeKey: e.dedupeKey,
        createdAt: e.createdAt?.toISOString() ?? null,
      })),
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }
}
