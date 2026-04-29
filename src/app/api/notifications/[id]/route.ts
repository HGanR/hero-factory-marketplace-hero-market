import { NextResponse } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { getAuthedUserId } from "@/lib/api/auth";
import { getDb } from "@/lib/db";
import { bentleyNotificationEvents } from "@/lib/db/schema";
import {
  mapNotificationRowToApiItem,
  NOTIFICATION_CENTER_SOURCE_TYPES,
} from "@/lib/notifications/bentley-in-app-notification-api";

/**
 * PATCH /api/notifications/[id] — mark one event read (current user + allowed source types only).
 */
export async function PATCH(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getAuthedUserId();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id: eventId } = await params;
    if (!eventId?.trim()) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    const db = await getDb();
    const uid = String(userId);

    const found = await db
      .select()
      .from(bentleyNotificationEvents)
      .where(
        and(
          eq(bentleyNotificationEvents.id, eventId),
          eq(bentleyNotificationEvents.userId, uid),
          inArray(bentleyNotificationEvents.sourceType, [...NOTIFICATION_CENTER_SOURCE_TYPES])
        )
      )
      .limit(1);

    const row = found[0] ?? null;
    if (!row) {
      return NextResponse.json({ error: "Not found", message: "Notification not found." }, { status: 404 });
    }

    if (row.readAt) {
      return NextResponse.json({ ok: true as const, event: mapNotificationRowToApiItem(row) });
    }

    const readAt = new Date();
    await db
      .update(bentleyNotificationEvents)
      .set({ readAt })
      .where(and(eq(bentleyNotificationEvents.id, eventId), eq(bentleyNotificationEvents.userId, uid)));

    const updated = await db
      .select()
      .from(bentleyNotificationEvents)
      .where(and(eq(bentleyNotificationEvents.id, eventId), eq(bentleyNotificationEvents.userId, uid)))
      .limit(1);
    const out = updated[0];
    if (!out) {
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }

    return NextResponse.json({ ok: true as const, event: mapNotificationRowToApiItem(out) });
  } catch (e) {
    console.error("[PATCH /api/notifications/[id]]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
