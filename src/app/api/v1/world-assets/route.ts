/**
 * Platform API v1 - World Library Assets Catalog
 * GET /api/v1/world-assets — List published assets (read:assets)
 */
import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { worldLibraryAssets } from "@/lib/db/schema.worlds";
import { getPlatformApiContext } from "@/lib/platform-api/auth";
import { hasScope } from "@/lib/platform-api/scopes";
import { unauthorized, forbidden } from "@/lib/platform-api/errors";
import { recordApiKeyUsage } from "@/lib/platform-api/audit";

export async function GET(req: NextRequest) {
  const ctx = await getPlatformApiContext(req);
  if (!ctx) return unauthorized();
  if (!hasScope(ctx.scopes, "read:assets")) return forbidden();

  if (ctx.authType === "api_key" && ctx.apiKeyId) {
    recordApiKeyUsage(ctx.apiKeyId);
  }

  const category = req.nextUrl.searchParams.get("category");
  const db = await getDb();

  const baseWhere = and(
    eq(worldLibraryAssets.status, "published"),
    eq(worldLibraryAssets.isActive, true),
    eq(worldLibraryAssets.isPlatformOnly, false)
  );

  const assets = category
    ? await db
        .select()
        .from(worldLibraryAssets)
        .where(and(baseWhere, eq(worldLibraryAssets.category, category)))
    : await db.select().from(worldLibraryAssets).where(baseWhere);

  return NextResponse.json({
    data: assets.map((a) => ({
      id: a.id,
      slug: a.slug,
      name: a.name,
      category: a.category,
      description: a.description,
      previewImageUrl: a.previewImageUrl,
      modelUrl: a.modelUrl,
      manifestUrl: a.manifestUrl,
      tokenPrice: a.tokenPrice,
      supplyLimit: a.supplyLimit,
      collisionType: a.collisionType,
      instancable: a.instancable,
      boundsJson: a.boundsJson,
    })),
    meta: { count: assets.length },
  });
}
