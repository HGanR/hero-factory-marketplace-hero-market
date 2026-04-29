/**
 * Trust Records Instrument Events API
 * GET: List events for an instrument
 */
import { NextRequest, NextResponse } from "next/server";
import { and, eq, desc } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { trusts, trustInstruments, trustInstrumentEvents } from "@/lib/db/schema";
import { getAuthedUserId } from "@/lib/api/auth";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ instrumentId: string }> }
) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { instrumentId } = await ctx.params;
  if (!instrumentId) return NextResponse.json({ error: "Invalid instrumentId" }, { status: 400 });

  const db = await getDb();
  const [instrument] = await db
    .select()
    .from(trustInstruments)
    .where(eq(trustInstruments.id, instrumentId))
    .limit(1);
  if (!instrument) return NextResponse.json({ error: "Instrument not found" }, { status: 404 });

  const [trust] = await db
    .select()
    .from(trusts)
    .where(and(eq(trusts.id, instrument.trustId), eq(trusts.userId, userId)))
    .limit(1);
  if (!trust) return NextResponse.json({ error: "Trust not found" }, { status: 404 });

  const events = await db
    .select()
    .from(trustInstrumentEvents)
    .where(eq(trustInstrumentEvents.instrumentId, instrumentId))
    .orderBy(desc(trustInstrumentEvents.createdAt));

  return NextResponse.json({
    ok: true,
    instrumentId,
    events: events.map((e) => ({
      id: e.id,
      eventType: e.eventType,
      metadata: e.metadata,
      actorRole: e.actorRole,
      actorId: e.actorId,
      createdAt: e.createdAt?.toISOString(),
    })),
  });
}
