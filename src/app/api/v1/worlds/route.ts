/**
 * Platform API v1 - Worlds
 * GET /api/v1/worlds - List worlds (owned + public, or scope=me for owned only)
 */
import { NextRequest, NextResponse } from "next/server";
import { eq, and, or, desc } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { worlds } from "@/lib/db/schema.worlds";
import { getPlatformApiContext } from "@/lib/platform-api/auth";
import { hasScope } from "@/lib/platform-api/scopes";
import { unauthorized, forbidden } from "@/lib/platform-api/errors";
import { recordApiKeyUsage } from "@/lib/platform-api/audit";

export async function GET(req: NextRequest) {
  const ctx = await getPlatformApiContext(req);
  if (!ctx) return unauthorized();
  if (!hasScope(ctx.scopes, "read:worlds")) return forbidden();

  if (ctx.authType === "api_key" && ctx.apiKeyId) {
    recordApiKeyUsage(ctx.apiKeyId);
  }

  const scope = req.nextUrl.searchParams.get("scope") ?? "all";

  const db = await getDb();

  if (scope === "me") {
    const rows = await db
      .select()
      .from(worlds)
      .where(eq(worlds.ownerId, ctx.userId))
      .orderBy(desc(worlds.updatedAt))
      .limit(100);

    return NextResponse.json({
      data: rows.map((w) => ({
        id: w.id,
        name: w.name,
        description: w.description,
        visibility: w.visibility,
        terrainSeed: w.terrainSeed,
        biomeType: w.biomeType,
        status: w.status,
        ownerId: w.ownerId,
        createdAt: w.createdAt?.toISOString(),
        updatedAt: w.updatedAt?.toISOString(),
      })),
      meta: { count: rows.length },
    });
  }

  const [owned, publicRows] = await Promise.all([
    db
      .select()
      .from(worlds)
      .where(eq(worlds.ownerId, ctx.userId))
      .orderBy(desc(worlds.updatedAt))
      .limit(50),
    db
      .select()
      .from(worlds)
      .where(
        and(
          eq(worlds.status, "published"),
          or(eq(worlds.visibility, "public"), eq(worlds.visibility, "unlisted"))
        )
      )
      .orderBy(desc(worlds.updatedAt))
      .limit(50),
  ]);

  const seen = new Set(owned.map((w) => w.id));
  const combined = [...owned];
  for (const w of publicRows) {
    if (!seen.has(w.id)) {
      seen.add(w.id);
      combined.push(w);
    }
  }
  combined.sort((a, b) => (b.updatedAt?.getTime() ?? 0) - (a.updatedAt?.getTime() ?? 0));

  return NextResponse.json({
    data: combined.slice(0, 100).map((w) => ({
      id: w.id,
      name: w.name,
      description: w.description,
      visibility: w.visibility,
      terrainSeed: w.terrainSeed,
      biomeType: w.biomeType,
      status: w.status,
      ownerId: w.ownerId,
      createdAt: w.createdAt?.toISOString(),
      updatedAt: w.updatedAt?.toISOString(),
    })),
    meta: { count: combined.length },
  });
}
