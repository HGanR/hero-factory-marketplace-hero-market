/**
 * Platform API v1 - World Commerce Nodes
 * GET /api/v1/worlds/:id/commerce - List commerce nodes for a world
 * POST /api/v1/worlds/:id/commerce - Create commerce node (write:commerce, owner only)
 */
import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { worlds, worldCommerceNodes } from "@/lib/db/schema.worlds";
import { getPlatformApiContext } from "@/lib/platform-api/auth";
import { hasScope } from "@/lib/platform-api/scopes";
import { unauthorized, forbidden, notFound } from "@/lib/platform-api/errors";
import { recordApiKeyUsage } from "@/lib/platform-api/audit";
import { emitPlatformEvent } from "@/lib/workflow-engine/emit-platform-event";
import crypto from "crypto";

const VALID_NODE_TYPES = [
  "store",
  "service",
  "consultation",
  "ad_space",
  "product_display",
  "event_space",
  "course",
  "npc_service",
] as const;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getPlatformApiContext(req);
  if (!ctx) return unauthorized();
  if (!hasScope(ctx.scopes, "read:commerce")) return forbidden();

  if (ctx.authType === "api_key" && ctx.apiKeyId) {
    recordApiKeyUsage(ctx.apiKeyId);
  }

  const { id } = await params;
  const db = await getDb();

  const [world] = await db.select().from(worlds).where(eq(worlds.id, id)).limit(1);
  if (!world) return notFound("World not found");

  const isOwner = world.ownerId === ctx.userId;
  const isPublic = world.visibility === "public" || world.visibility === "unlisted";
  const isPublished = world.status === "published";

  if (!isOwner && (!isPublic || !isPublished)) {
    return notFound("World not found");
  }

  const nodes = await db
    .select()
    .from(worldCommerceNodes)
    .where(
      and(eq(worldCommerceNodes.worldId, id), eq(worldCommerceNodes.status, "active"))
    );

  return NextResponse.json({
    data: nodes.map((n) => ({
      id: n.id,
      worldId: n.worldId,
      ownerId: n.ownerId,
      nodeType: n.nodeType,
      placementJson: n.placementJson,
      assetId: n.assetId,
      title: n.title,
      description: n.description,
      agentId: n.agentId,
      entityId: n.entityId,
      priceToken: n.priceToken,
      priceUSD: n.priceUSD,
      revenueShare: n.revenueShare,
      status: n.status,
      createdAt: n.createdAt?.toISOString(),
    })),
    meta: { count: nodes.length },
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getPlatformApiContext(req);
  if (!ctx) return unauthorized();
  if (!hasScope(ctx.scopes, "write:commerce")) return forbidden();

  if (ctx.authType === "api_key" && ctx.apiKeyId) {
    recordApiKeyUsage(ctx.apiKeyId);
  }

  const { id: worldId } = await params;

  let body: {
    nodeType?: string;
    placementJson?: unknown;
    assetId?: string;
    title?: string;
    description?: string;
    priceToken?: number;
    priceUSD?: number;
    revenueShare?: number;
  };
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const nodeType = VALID_NODE_TYPES.includes((body.nodeType ?? "store") as (typeof VALID_NODE_TYPES)[number])
    ? (body.nodeType as (typeof VALID_NODE_TYPES)[number])
    : "store";
  const placementJson = body.placementJson ?? { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] };
  const title = String(body.title ?? "Commerce Node").slice(0, 120);

  const db = await getDb();
  const [world] = await db.select().from(worlds).where(eq(worlds.id, worldId)).limit(1);
  if (!world) return notFound("World not found");
  if (world.ownerId !== ctx.userId) return forbidden();

  const id = crypto.randomUUID();
  await db.insert(worldCommerceNodes).values({
    id,
    worldId,
    ownerId: ctx.userId,
    nodeType,
    placementJson: placementJson as object,
    assetId: body.assetId ?? null,
    title,
    description: body.description ?? null,
    agentId: null,
    entityId: null,
    priceToken: body.priceToken ?? null,
    priceUSD: body.priceUSD ?? null,
    revenueShare: body.revenueShare ?? null,
    status: "active",
  });

  try {
    await emitPlatformEvent(
      "commerce_node_created",
      { worldId, nodeId: id, nodeType, title, ownerId: ctx.userId },
      ctx.userId
    );
  } catch {
    // Don't fail create if event fails
  }

  return NextResponse.json({
    success: true,
    node: {
      id,
      worldId,
      ownerId: ctx.userId,
      nodeType,
      placementJson,
      title,
      status: "active",
    },
  });
}
