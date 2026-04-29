import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq, inArray } from "drizzle-orm";
import { getAuthedUserId } from "@/lib/api/auth";
import { getDb } from "@/lib/db";
import { bentleyNotificationEvents } from "@/lib/db/schema";
import {
  mapNotificationRowToApiItem,
  NOTIFICATION_CENTER_SOURCE_TYPES,
  parseNotificationLimit,
} from "@/lib/notifications/bentley-in-app-notification-api";

/**
 * GET /api/notifications?limit=10 — recent in-app events for the current user (bounded source types).
 */
export async function GET(req: NextRequest) {
  try {
    const userId = await getAuthedUserId();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const limit = parseNotificationLimit(req.nextUrl.searchParams.get("limit"));
    const db = await getDb();
    const uid = String(userId);

    const rows = await db
      .select()
      .from(bentleyNotificationEvents)
      .where(
        and(
          eq(bentleyNotificationEvents.userId, uid),
          inArray(bentleyNotificationEvents.sourceType, [...NOTIFICATION_CENTER_SOURCE_TYPES])
        )
      )
      .orderBy(desc(bentleyNotificationEvents.createdAt))
      .limit(limit);

    return NextResponse.json({
      events: rows.map(mapNotificationRowToApiItem),
    });
  } catch (e) {
    console.error("[GET /api/notifications]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
