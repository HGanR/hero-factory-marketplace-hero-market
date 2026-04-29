/**
 * Platform API v1 - World Links
 * GET /api/v1/worlds/:id/links — List outgoing world links (read:worlds)
 * POST /api/v1/worlds/:id/links — Add world link (write:worlds, owner only)
 */
import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { worlds, worldLinks } from "@/lib/db/schema.worlds";
import { getPlatformApiContext } from "@/lib/platform-api/auth";
import { hasScope } from "@/lib/platform-api/scopes";
import { unauthorized, forbidden, notFound } from "@/lib/platform-api/errors";
import { recordApiKeyUsage } from "@/lib/platform-api/audit";
import crypto from "crypto";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getPlatformApiContext(_req);
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

  const links = await db
    .select()
    .from(worldLinks)
    .where(eq(worldLinks.fromWorldId, worldId));

  return NextResponse.json({
    data: links.map((l) => ({
      id: l.id,
      fromWorldId: l.fromWorldId,
      toWorldId: l.toWorldId,
      label: l.label,
      placementJson: l.placementJson,
    })),
    meta: { count: links.length },
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

  let body: { toWorldId?: string; label?: string; placementJson?: unknown };
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const toWorldId = String(body.toWorldId ?? "").trim();
  if (!toWorldId) return NextResponse.json({ error: "toWorldId required" }, { status: 400 });

  const db = await getDb();
  const [world] = await db.select().from(worlds).where(eq(worlds.id, worldId)).limit(1);
  if (!world) return notFound("World not found");
  if (world.ownerId !== ctx.userId) return forbidden();

  const [targetWorld] = await db.select().from(worlds).where(eq(worlds.id, toWorldId)).limit(1);
  if (!targetWorld) return notFound("Target world not found");

  const id = crypto.randomUUID();
  await db.insert(worldLinks).values({
    id,
    fromWorldId: worldId,
    toWorldId,
    label: body.label?.slice(0, 120) ?? null,
    placementJson: (body.placementJson as object) ?? null,
  });

  return NextResponse.json({
    success: true,
    link: {
      id,
      fromWorldId: worldId,
      toWorldId,
      label: body.label,
      placementJson: body.placementJson,
    },
  });
}
