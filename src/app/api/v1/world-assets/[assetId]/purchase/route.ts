/**
 * Platform API v1 - Purchase World Library Asset
 * POST /api/v1/world-assets/:assetId/purchase — Requires write:assets
 */
import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { worldLibraryAssets, userWorldAssets } from "@/lib/db/schema.worlds";
import { getPlatformApiContext } from "@/lib/platform-api/auth";
import { hasScope } from "@/lib/platform-api/scopes";
import { unauthorized, forbidden, notFound } from "@/lib/platform-api/errors";
import { recordApiKeyUsage } from "@/lib/platform-api/audit";
import { emitPlatformEvent } from "@/lib/workflow-engine/emit-platform-event";
import crypto from "crypto";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ assetId: string }> }
) {
  const ctx = await getPlatformApiContext(req);
  if (!ctx) return unauthorized();
  if (!hasScope(ctx.scopes, "write:assets")) return forbidden();

  if (ctx.authType === "api_key" && ctx.apiKeyId) {
    recordApiKeyUsage(ctx.apiKeyId);
  }

  const { assetId } = await params;

  let body: { worldId?: string; licenseScope?: string; txRef?: string };
  try {
    body = await req.json();
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

  if (!asset) return notFound("Asset not found");

  const [existing] = await db
    .select()
    .from(userWorldAssets)
    .where(
      and(
        eq(userWorldAssets.userId, ctx.userId),
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
      .select()
      .from(userWorldAssets)
      .where(eq(userWorldAssets.assetId, assetId));
    if (countResult.length >= asset.supplyLimit) {
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
    userId: ctx.userId,
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
        userId: ctx.userId,
        ownershipId,
        tokenPrice: asset.tokenPrice,
        licenseScope,
        worldId: body.worldId,
      },
      ctx.userId
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
}
