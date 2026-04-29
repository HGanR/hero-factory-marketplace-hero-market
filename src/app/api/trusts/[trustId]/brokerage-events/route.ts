/**
 * Trust Asset Events API (Brokerage Deposit Ledger)
 * GET: List append-only events for a trust
 */
import { NextRequest, NextResponse } from "next/server";
import { and, eq, desc } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { trusts, trustAssetEvents } from "@/lib/db/schema";
import { getAuthedUserId } from "@/lib/api/auth";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ trustId: string }> }
) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { trustId } = await ctx.params;
  if (!trustId) return NextResponse.json({ error: "Invalid trustId" }, { status: 400 });

  const db = await getDb();
  const trustRows = await db
    .select()
    .from(trusts)
    .where(and(eq(trusts.id, trustId), eq(trusts.userId, userId)))
    .limit(1);
  if (trustRows.length === 0) return NextResponse.json({ error: "Trust not found" }, { status: 404 });

  const events = await db
    .select()
    .from(trustAssetEvents)
    .where(eq(trustAssetEvents.trustId, trustId))
    .orderBy(desc(trustAssetEvents.createdAt));

  return NextResponse.json({
    trustId,
    events: events.map((e) => ({
      id: e.id,
      trustId: e.trustId,
      assetId: e.assetId,
      eventType: e.eventType,
      metadata: e.metadata,
      createdAt: e.createdAt?.toISOString(),
    })),
  });
}
