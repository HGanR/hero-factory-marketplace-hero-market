/**
 * POST /api/world-assets/[assetId]/purchase — Purchase a world library asset
 * Creates user_world_assets entry. For tokenPrice > 0, payment wiring is future work.
 */
import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { worldLibraryAssets, userWorldAssets } from "@/lib/db/schema.worlds";
import { getAuthedUserId } from "@/lib/api/auth";
import { emitPlatformEvent } from "@/lib/workflow-engine/emit-platform-event";
import crypto from "crypto";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ assetId: string }> }
) {
  try {
    const { assetId } = await params;
    const userId = await getAuthedUserId();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    let body: { worldId?: string; licenseScope?: string; txRef?: string };
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    const db = await getDb();

    const [asset] = await db
      .select()
      .from(worldLibraryAssets)
      .where(
        and(
          eq(worldLibraryAssets.id, assetId),
          eq(worldLibraryAssets.status, "published"),
          eq(worldLibraryAssets.isActive, true),
          eq(worldLibraryAssets.isPlatformOnly, false)
        )
      )
      .limit(1);

    if (!asset) return NextResponse.json({ error: "Asset not found" }, { status: 404 });

    const [existing] = await db
      .select()
      .from(userWorldAssets)
      .where(
        and(
          eq(userWorldAssets.userId, userId),
          eq(userWorldAssets.assetId, assetId)
        )
      )
      .limit(1);

    if (existing) {
      return NextResponse.json({
        success: true,
        alreadyOwned: true,
        ownershipId: existing.id,
      });
    }

    if (asset.supplyLimit != null) {
      const countResult = await db
        .select({ count: userWorldAssets.id })
        .from(userWorldAssets)
        .where(eq(userWorldAssets.assetId, assetId));
      const sold = countResult.length;
      if (sold >= asset.supplyLimit) {
        return NextResponse.json({ error: "Asset sold out" }, { status: 400 });
      }
    }

    const licenseScope =
      body.licenseScope === "one_world" && body.worldId
        ? "one_world"
        : body.licenseScope === "quantity_based"
          ? "quantity_based"
          : "all_worlds_owned";

    const remainingPlacements =
      licenseScope === "quantity_based" ? (asset.supplyLimit ?? 1) : null;

    const ownershipId = crypto.randomUUID();
    const purchaseTx = body.txRef ?? `asset_${ownershipId}`;

    await db.insert(userWorldAssets).values({
      id: ownershipId,
      userId,
      workspaceId: body.worldId ?? null,
      assetId,
      licenseScope: licenseScope as "all_worlds_owned" | "one_world" | "quantity_based",
      remainingPlacements,
      purchaseTx,
    });

    try {
      await emitPlatformEvent(
        "asset_purchased",
        {
          assetId,
          userId,
          ownershipId,
          tokenPrice: asset.tokenPrice,
          licenseScope,
          worldId: body.worldId,
        },
        userId
      );
    } catch {
      // Don't fail purchase if event fails
    }

    return NextResponse.json({
      success: true,
      alreadyOwned: false,
      ownershipId,
      assetId,
      licenseScope,
      tokenPrice: asset.tokenPrice,
    });
  } catch (e) {
    console.error("[api/world-assets/[assetId]/purchase POST]", e);
    return NextResponse.json({ error: "Failed to purchase asset" }, { status: 500 });
  }
}
