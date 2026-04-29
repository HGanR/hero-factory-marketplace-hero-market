/**
 * GET /api/world-assets — Published marketplace assets (excludes isPlatformOnly)
 */
import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { worldLibraryAssets } from "@/lib/db/schema.worlds";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const category = searchParams.get("category");

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
      assets: assets.map((a) => ({
        id: a.id,
        slug: a.slug,
        name: a.name,
        category: a.category,
        description: a.description,
        previewImageUrl: a.previewImageUrl,
        modelUrl: a.modelUrl,
        manifestUrl: a.manifestUrl,
        tokenPrice: a.tokenPrice,
        collisionType: a.collisionType,
        instancable: a.instancable,
        boundsJson: a.boundsJson,
      })),
    });
  } catch (e) {
    console.error("[api/world-assets GET]", e);
    return NextResponse.json({ error: "Failed to load assets" }, { status: 500 });
  }
}
