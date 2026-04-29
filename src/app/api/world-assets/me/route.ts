/**
 * GET /api/world-assets/me — Assets owned by current user/workspace
 */
import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { userWorldAssets, worldLibraryAssets } from "@/lib/db/schema.worlds";
import { getAuthedUserId } from "@/lib/api/auth";

export async function GET(request: NextRequest) {
  try {
    const userId = await getAuthedUserId();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const db = await getDb();

    const owned = await db
      .select({
        id: userWorldAssets.id,
        assetId: userWorldAssets.assetId,
        licenseScope: userWorldAssets.licenseScope,
        remainingPlacements: userWorldAssets.remainingPlacements,
        purchasedAt: userWorldAssets.purchasedAt,
        slug: worldLibraryAssets.slug,
        name: worldLibraryAssets.name,
        category: worldLibraryAssets.category,
        modelUrl: worldLibraryAssets.modelUrl,
        previewImageUrl: worldLibraryAssets.previewImageUrl,
        manifestUrl: worldLibraryAssets.manifestUrl,
        collisionType: worldLibraryAssets.collisionType,
        instancable: worldLibraryAssets.instancable,
        boundsJson: worldLibraryAssets.boundsJson,
      })
      .from(userWorldAssets)
      .innerJoin(worldLibraryAssets, eq(userWorldAssets.assetId, worldLibraryAssets.id))
      .where(eq(userWorldAssets.userId, userId));

    return NextResponse.json({
      assets: owned.map((a) => ({
        id: a.assetId,
        ownershipId: a.id,
        slug: a.slug,
        name: a.name,
        category: a.category,
        modelUrl: a.modelUrl,
        previewImageUrl: a.previewImageUrl,
        manifestUrl: a.manifestUrl,
        collisionType: a.collisionType,
        instancable: a.instancable,
        boundsJson: a.boundsJson,
        licenseScope: a.licenseScope,
        remainingPlacements: a.remainingPlacements,
        purchasedAt: a.purchasedAt?.toISOString(),
      })),
    });
  } catch (e) {
    console.error("[api/world-assets/me GET]", e);
    return NextResponse.json({ error: "Failed to load owned assets" }, { status: 500 });
  }
}
