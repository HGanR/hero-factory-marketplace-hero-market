/**
 * Platform API v1 - World by ID
 * GET /api/v1/worlds/:id - Get world metadata
 */
import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { worlds } from "@/lib/db/schema.worlds";
import { getPlatformApiContext } from "@/lib/platform-api/auth";
import { hasScope } from "@/lib/platform-api/scopes";
import { unauthorized, forbidden, notFound } from "@/lib/platform-api/errors";
import { recordApiKeyUsage } from "@/lib/platform-api/audit";

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

  return NextResponse.json({
    data: {
      id: world.id,
      name: world.name,
      description: world.description,
      visibility: world.visibility,
      terrainSeed: world.terrainSeed,
      biomeType: world.biomeType,
      status: world.status,
      ownerId: isOwner ? world.ownerId : undefined,
      createdAt: world.createdAt?.toISOString(),
      updatedAt: world.updatedAt?.toISOString(),
    },
  });
}
