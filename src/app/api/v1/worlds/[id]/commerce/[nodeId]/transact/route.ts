/**
 * Platform API v1 - Commerce Transaction
 * POST /api/v1/worlds/:id/commerce/:nodeId/transact — Record a commerce transaction
 */
import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { worlds, worldCommerceNodes, commerceTransactions } from "@/lib/db/schema.worlds";
import { getPlatformApiContext } from "@/lib/platform-api/auth";
import { hasScope } from "@/lib/platform-api/scopes";
import { unauthorized, forbidden, notFound } from "@/lib/platform-api/errors";
import { recordApiKeyUsage } from "@/lib/platform-api/audit";
import { emitPlatformEvent } from "@/lib/workflow-engine/emit-platform-event";
import crypto from "crypto";

function generateId(): string {
  return crypto.randomUUID();
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; nodeId: string }> }
) {
  const ctx = await getPlatformApiContext(req);
  if (!ctx) return unauthorized();
  if (!hasScope(ctx.scopes, "write:commerce")) return forbidden();

  if (ctx.authType === "api_key" && ctx.apiKeyId) {
    recordApiKeyUsage(ctx.apiKeyId);
  }

  const { id: worldId, nodeId } = await params;

  let body: { amountToken?: number; amountUSD?: number; txRef?: string };
  try {
    body = await req.json();
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
  if (!world) return notFound("World not found");

  const isPublic = world.visibility === "public" || world.visibility === "unlisted";
  const isPublished = world.status === "published";
  if (!isPublic || !isPublished) {
    return notFound("World not found");
  }

  const [node] = await db
    .select()
    .from(worldCommerceNodes)
    .where(
      and(
        eq(worldCommerceNodes.id, nodeId),
        eq(worldCommerceNodes.worldId, worldId),
        eq(worldCommerceNodes.status, "active")
      )
    )
    .limit(1);

  if (!node) return notFound("Commerce node not found");

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
    nodeId,
    payerId: ctx.userId,
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
        nodeId,
        transactionId: txId,
        payerId: ctx.userId,
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
      ctx.userId
    );
  } catch {
    // Don't fail transact if event fails
  }

  return NextResponse.json({
    success: true,
    transaction: {
      id: txId,
      worldId,
      nodeId,
      payerId: ctx.userId,
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
}
