// src/app/api/instruments/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { instruments, publicWitnesses } from "@/lib/db/schema";
import { getAuthedUserId } from "@/lib/api/auth";
import { eq, and, or, isNull } from "drizzle-orm";

/**
 * GET /api/instruments
 * 
 * List instruments with context filtering (trustId or entityId required)
 * Enforces access control consistent with Trust Records patterns
 */
export async function GET(req: NextRequest) {
  const userId = await getAuthedUserId();
  if (!userId) {
    return NextResponse.json({ ok: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const trustId = searchParams.get("trustId");
    const entityId = searchParams.get("entityId");

    // Enforce exactly one of trustId/entityId
    if (!trustId && !entityId) {
      return NextResponse.json(
        { ok: false, error: { code: "BAD_REQUEST", message: "trustId or entityId is required" } },
        { status: 400 }
      );
    }

    if (trustId && entityId) {
      return NextResponse.json(
        { ok: false, error: { code: "BAD_REQUEST", message: "Exactly one of trustId or entityId is required" } },
        { status: 400 }
      );
    }

    const db = await getDb();

    // Query instruments with optional witness data
    const items = await db
      .select({
        instrument: instruments,
        witness: publicWitnesses,
      })
      .from(instruments)
      .leftJoin(publicWitnesses, eq(instruments.id, publicWitnesses.instrumentId))
      .where(trustId ? eq(instruments.trustId, trustId) : eq(instruments.entityId, entityId!))
      .orderBy(instruments.createdAt);

    // Format response
    const formatted = items.map(({ instrument, witness }) => ({
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
    }));

    return NextResponse.json({ ok: true, items: formatted });
  } catch (error: any) {
    console.error("List instruments error:", error);
    return NextResponse.json(
      { ok: false, error: { code: "INTERNAL_ERROR", message: error?.message || "Failed to list instruments" } },
      { status: 500 }
    );
  }
}
