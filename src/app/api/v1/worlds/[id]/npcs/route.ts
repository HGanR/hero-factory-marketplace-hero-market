/**
 * Platform API v1 - World NPCs
 * GET /api/v1/worlds/:id/npcs — List NPCs (read:worlds)
 * POST /api/v1/worlds/:id/npcs — Spawn NPC (write:worlds, owner only)
 */
import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { worlds, worldNpcs } from "@/lib/db/schema.worlds";
import { getPlatformApiContext } from "@/lib/platform-api/auth";
import { hasScope } from "@/lib/platform-api/scopes";
import { unauthorized, forbidden, notFound } from "@/lib/platform-api/errors";
import { recordApiKeyUsage } from "@/lib/platform-api/audit";
import crypto from "crypto";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getPlatformApiContext(req);
  if (!ctx) return unauthorized();
  if (!hasScope(ctx.scopes, "read:worlds")) return forbidden();

  if (ctx.authType === "api_key" && ctx.apiKeyId) {
    recordApiKeyUsage(ctx.apiKeyId);
  }

  const { id: worldId } = await params;
  const db = await getDb();

  const [world] = await db.select().from(worlds).where(eq(worlds.id, worldId)).limit(1);
  if (!world) return notFound("World not found");

  const isOwner = world.ownerId === ctx.userId;
  const isPublic = world.visibility === "public" || world.visibility === "unlisted";
  const isPublished = world.status === "published";
  if (!isOwner && (!isPublic || !isPublished)) {
    return notFound("World not found");
  }

  const npcs = await db
    .select()
    .from(worldNpcs)
    .where(eq(worldNpcs.worldId, worldId));

  return NextResponse.json({
    data: npcs.map((n) => ({
      id: n.id,
      worldId: n.worldId,
      agentId: n.agentId,
      buildingId: n.buildingId,
      placementJson: n.placementJson,
      role: n.role,
      voiceProfile: n.voiceProfile,
    })),
    meta: { count: npcs.length },
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getPlatformApiContext(req);
  if (!ctx) return unauthorized();
  if (!hasScope(ctx.scopes, "write:worlds")) return forbidden();

  if (ctx.authType === "api_key" && ctx.apiKeyId) {
    recordApiKeyUsage(ctx.apiKeyId);
  }

  const { id: worldId } = await params;

  let body: { agentId?: string; placementJson?: unknown; role?: string; voiceProfile?: string };
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const agentId = String(body.agentId ?? "default").slice(0, 80);
  const placementJson = body.placementJson ?? { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] };

  const db = await getDb();
  const [world] = await db.select().from(worlds).where(eq(worlds.id, worldId)).limit(1);
  if (!world) return notFound("World not found");
  if (world.ownerId !== ctx.userId) return forbidden();

  const id = crypto.randomUUID();
  await db.insert(worldNpcs).values({
    id,
    worldId,
    agentId,
    buildingId: null,
    placementJson: placementJson as object,
    role: body.role ?? null,
    voiceProfile: body.voiceProfile ?? null,
  });

  return NextResponse.json({
    success: true,
    npc: {
      id,
      worldId,
      agentId,
      placementJson,
      role: body.role,
      voiceProfile: body.voiceProfile,
    },
  });
}
