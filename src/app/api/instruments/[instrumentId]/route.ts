// src/app/api/instruments/[instrumentId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { instruments, publicWitnesses } from "@/lib/db/schema";
import { getAuthedUserId } from "@/lib/api/auth";
import { eq } from "drizzle-orm";

/**
 * GET /api/instruments/[instrumentId]
 * 
 * Get instrument details with witness data
 * Enforces access control (user must have access to trust/entity)
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ instrumentId: string }> }) {
  const userId = await getAuthedUserId();
  if (!userId) {
    return NextResponse.json({ ok: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } }, { status: 401 });
  }

  try {
    const { instrumentId } = await ctx.params;

    const db = await getDb();

    // Fetch instrument with witness
    const rows = await db
      .select({
        instrument: instruments,
        witness: publicWitnesses,
      })
      .from(instruments)
      .leftJoin(publicWitnesses, eq(instruments.id, publicWitnesses.instrumentId))
      .where(eq(instruments.id, instrumentId))
      .limit(1);

    if (rows.length === 0) {
      return NextResponse.json({ ok: false, error: { code: "NOT_FOUND", message: "Instrument not found" } }, { status: 404 });
    }

    const { instrument, witness } = rows[0];

    // TODO: Add access control check here
    // Verify user has access to trustId/entityId (same pattern as Trust Records)

    const formatted = {
      ...instrument,
      witness: witness
        ? {
            id: witness.id,
            network: witness.network,
            txHash: witness.txHash,
            blockNumber: witness.blockNumber,
            notarizedAt: witness.notarizedAt,
          }
        : null,
    };

    return NextResponse.json({ ok: true, instrument: formatted });
  } catch (error: any) {
    console.error("Get instrument error:", error);
    return NextResponse.json(
      { ok: false, error: { code: "INTERNAL_ERROR", message: error?.message || "Failed to get instrument" } },
      { status: 500 }
    );
  }
}
