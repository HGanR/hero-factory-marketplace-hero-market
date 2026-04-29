/**
 * POST /api/worlds/[worldId]/commerce/[id]/transact — Record a commerce transaction
 * Payer must be authenticated. Creates transaction record and emits commerce_transaction event.
 */
import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { worlds, worldCommerceNodes, commerceTransactions } from "@/lib/db/schema.worlds";
import { getAuthedUserId } from "@/lib/api/auth";
import { emitPlatformEvent } from "@/lib/workflow-engine/emit-platform-event";
import crypto from "crypto";

function generateId(): string {
  return crypto.randomUUID();
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ worldId: string; id: string }> }
) {
  try {
    const { worldId, id } = await params;
    const userId = await getAuthedUserId();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    let body: { amountToken?: number; amountUSD?: number; txRef?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const amountToken = body.amountToken ?? 0;
    const amountUSD = body.amountUSD ?? 0;
    if (amountToken <= 0 && amountUSD <= 0) {
      return NextResponse.json({ error: "amountToken or amountUSD required" }, { status: 400 });
    }

    const db = await getDb();

    const [world] = await db.select().from(worlds).where(eq(worlds.id, worldId)).limit(1);
    if (!world) return NextResponse.json({ error: "World not found" }, { status: 404 });

    const isPublic = world.visibility === "public" || world.visibility === "unlisted";
    const isPublished = world.status === "published";
    if (!isPublic || !isPublished) {
      return NextResponse.json({ error: "World not found" }, { status: 404 });
    }

    const [node] = await db
      .select()
      .from(worldCommerceNodes)
      .where(
        and(
          eq(worldCommerceNodes.id, id),
          eq(worldCommerceNodes.worldId, worldId),
          eq(worldCommerceNodes.status, "active")
        )
      )
      .limit(1);

    if (!node) return NextResponse.json({ error: "Commerce node not found" }, { status: 404 });

    const payeeId = node.ownerId;
    const revenueShare = node.revenueShare ?? 20;
    const platformPercent = Math.min(100, Math.max(0, revenueShare));

    const platformFeeToken = amountToken > 0 ? Math.floor((amountToken * platformPercent) / 100) : 0;
    const platformFeeUSD = amountUSD > 0 ? Math.floor((amountUSD * platformPercent) / 100) : 0;
    const ownerAmountToken = amountToken - platformFeeToken;
    const ownerAmountUSD = amountUSD - platformFeeUSD;

    const currency = amountToken > 0 && amountUSD > 0 ? "both" : amountUSD > 0 ? "usd" : "token";

    const txId = generateId();
    await db.insert(commerceTransactions).values({
      id: txId,
      worldId,
      nodeId: id,
      payerId: userId,
      payeeId,
      amountToken: amountToken || null,
      amountUSD: amountUSD || null,
      platformFeeToken: platformFeeToken || null,
      platformFeeUSD: platformFeeUSD || null,
      ownerAmountToken: ownerAmountToken || null,
      ownerAmountUSD: ownerAmountUSD || null,
      currency,
      status: "completed",
      txRef: body.txRef ?? null,
      metadataJson: { nodeType: node.nodeType, title: node.title },
    });

    try {
      await emitPlatformEvent(
        "commerce_transaction",
        {
          worldId,
          nodeId: id,
          transactionId: txId,
          payerId: userId,
          payeeId,
          amountToken,
          amountUSD,
          platformFeeToken,
          platformFeeUSD,
          ownerAmountToken,
          ownerAmountUSD,
          nodeType: node.nodeType,
          title: node.title,
        },
        userId
      );
    } catch {
      // Don't fail transact if event fails
    }

    return NextResponse.json({
      success: true,
      transaction: {
        id: txId,
        worldId,
        nodeId: id,
        payerId: userId,
        payeeId,
        amountToken,
        amountUSD,
        platformFeeToken,
        platformFeeUSD,
        ownerAmountToken,
        ownerAmountUSD,
        status: "completed",
      },
    });
  } catch (e) {
    console.error("[api/worlds/.../commerce/.../transact POST]", e);
    return NextResponse.json({ error: "Failed to record transaction" }, { status: 500 });
  }
}
