/**
 * Platform API v1 - Commerce Node Transactions
 * GET /api/v1/worlds/:id/commerce/:nodeId/transactions — List transactions (owner, read:commerce)
 */
import { NextRequest, NextResponse } from "next/server";
import { eq, and, desc } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { worlds, worldCommerceNodes, commerceTransactions } from "@/lib/db/schema.worlds";
import { getPlatformApiContext } from "@/lib/platform-api/auth";
import { hasScope } from "@/lib/platform-api/scopes";
import { unauthorized, forbidden, notFound } from "@/lib/platform-api/errors";
import { recordApiKeyUsage } from "@/lib/platform-api/audit";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; nodeId: string }> }
) {
  const ctx = await getPlatformApiContext(req);
  if (!ctx) return unauthorized();
  if (!hasScope(ctx.scopes, "read:commerce")) return forbidden();

  if (ctx.authType === "api_key" && ctx.apiKeyId) {
    recordApiKeyUsage(ctx.apiKeyId);
  }

  const { id: worldId, nodeId } = await params;
  const db = await getDb();

  const [world] = await db.select().from(worlds).where(eq(worlds.id, worldId)).limit(1);
  if (!world) return notFound("World not found");

  const [node] = await db
    .select()
    .from(worldCommerceNodes)
    .where(
      and(
        eq(worldCommerceNodes.id, nodeId),
        eq(worldCommerceNodes.worldId, worldId)
      )
    )
    .limit(1);

  if (!node) return notFound("Commerce node not found");
  if (node.ownerId !== ctx.userId) return forbidden();

  const txs = await db
    .select()
    .from(commerceTransactions)
    .where(
      and(
        eq(commerceTransactions.worldId, worldId),
        eq(commerceTransactions.nodeId, nodeId),
        eq(commerceTransactions.status, "completed")
      )
    )
    .orderBy(desc(commerceTransactions.createdAt))
    .limit(50);

  const totalOwnerToken = txs.reduce((s, t) => s + (t.ownerAmountToken ?? 0), 0);
  const totalOwnerUSD = txs.reduce((s, t) => s + (t.ownerAmountUSD ?? 0), 0);

  return NextResponse.json({
    data: txs.map((t) => ({
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
    meta: {
      count: txs.length,
      totalOwnerToken,
      totalOwnerUSD,
    },
  });
}
