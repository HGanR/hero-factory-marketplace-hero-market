/**
 * Platform Activity Stream API
 * GET: List recent events for current user
 */
import { NextRequest, NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { platformActivity } from "@/lib/db/schema";
import { getAuthedUserId } from "@/lib/api/auth";

export async function GET(req: NextRequest) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50", 10) || 50, 100);

  const db = await getDb();
  const events = await db
    .select()
    .from(platformActivity)
    .where(eq(platformActivity.userId, userId))
    .orderBy(desc(platformActivity.createdAt))
    .limit(limit);

  return NextResponse.json({
    ok: true,
    events: events.map((e) => ({
      id: e.id,
      eventType: e.eventType,
      sourceModule: e.sourceModule,
      payload: e.payload,
      trustId: e.trustId,
      createdAt: e.createdAt?.toISOString(),
    })),
  });
}
