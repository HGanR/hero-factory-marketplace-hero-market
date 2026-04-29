/**
 * GET /api/worlds/[worldId]/commerce/[id]/transactions — List transactions for a commerce node (owner only)
 */
import { NextResponse } from "next/server";
import { eq, and, desc } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { worlds, worldCommerceNodes, commerceTransactions } from "@/lib/db/schema.worlds";
import { getAuthedUserId } from "@/lib/api/auth";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ worldId: string; id: string }> }
) {
  try {
    const { worldId, id } = await params;
    const userId = await getAuthedUserId();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const db = await getDb();

    const [world] = await db.select().from(worlds).where(eq(worlds.id, worldId)).limit(1);
    if (!world) return NextResponse.json({ error: "World not found" }, { status: 404 });

    const [node] = await db
      .select()
      .from(worldCommerceNodes)
      .where(
        and(
          eq(worldCommerceNodes.id, id),
          eq(worldCommerceNodes.worldId, worldId)
        )
      )
      .limit(1);

    if (!node) return NextResponse.json({ error: "Commerce node not found" }, { status: 404 });
    if (node.ownerId !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const txs = await db
      .select()
      .from(commerceTransactions)
      .where(
        and(
          eq(commerceTransactions.worldId, worldId),
          eq(commerceTransactions.nodeId, id),
          eq(commerceTransactions.status, "completed")
        )
      )
      .orderBy(desc(commerceTransactions.createdAt))
      .limit(50);

    const totalOwnerToken = txs.reduce((s, t) => s + (t.ownerAmountToken ?? 0), 0);
    const totalOwnerUSD = txs.reduce((s, t) => s + (t.ownerAmountUSD ?? 0), 0);

    return NextResponse.json({
      transactions: txs.map((t) => ({
        id: t.id,
        payerId: t.payerId,
        amountToken: t.amountToken,
        amountUSD: t.amountUSD,
        ownerAmountToken: t.ownerAmountToken,
        ownerAmountUSD: t.ownerAmountUSD,
        platformFeeToken: t.platformFeeToken,
        platformFeeUSD: t.platformFeeUSD,
        status: t.status,
        createdAt: t.createdAt?.toISOString(),
      })),
      summary: {
        count: txs.length,
        totalOwnerToken,
        totalOwnerUSD,
      },
    });
  } catch (e) {
    console.error("[api/worlds/.../commerce/.../transactions GET]", e);
    return NextResponse.json({ error: "Failed to load transactions" }, { status: 500 });
  }
}
