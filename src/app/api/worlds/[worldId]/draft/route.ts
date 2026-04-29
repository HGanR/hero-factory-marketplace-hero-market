/**
 * PUT /api/worlds/[worldId]/draft — Save draft chunk placements
 * Owner or admin only. Does not affect published version.
 */
import { NextRequest, NextResponse } from "next/server";
import { eq, and, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db";
import {
  worlds,
  worldVersions,
  worldChunkPlacements,
  userWorldAssets,
} from "@/lib/db/schema.worlds";
import { getAuthedUserId } from "@/lib/api/auth";
import { verifyToken } from "@/lib/auth";
import { emitPlatformEvent } from "@/lib/workflow-engine/emit-platform-event";
import crypto from "crypto";

function generateId(): string {
  return crypto.randomUUID();
}

function normalizeAddress(addr: string | null | undefined): string | null {
  if (!addr || typeof addr !== "string") return null;
  const a = addr.trim().toLowerCase();
  return a.startsWith("0x") && a.length === 42 ? a : null;
}

async function isOwnerOrAdmin(
  request: NextRequest,
  world: { id: string; ownerId: number; ownerWallet: string | null }
): Promise<{ ok: true; userId: number } | { ok: false; status: number }> {
  const userId = await getAuthedUserId();
  if (userId !== null && userId === world.ownerId) {
    return { ok: true, userId };
  }
  const walletHeader = request.headers.get("x-wallet-address");
  const signature = request.headers.get("x-wallet-signature");
  const signedMessage = request.headers.get("x-wallet-message");
  const connectedWallet = normalizeAddress(walletHeader);
  if (
    world.ownerWallet &&
    connectedWallet &&
    normalizeAddress(world.ownerWallet) === connectedWallet
  ) {
    if (!signature || !signedMessage) {
      return { ok: false, status: 401 };
    }
    const { verifyWorldWalletSignature } = await import("@/lib/world-wallet-auth");
    if (!verifyWorldWalletSignature(world.id, connectedWallet, signedMessage, signature)) {
      return { ok: false, status: 401 };
    }
    return { ok: true, userId: userId ?? 0 };
  }
  const adminToken = request.cookies.get("admin-token")?.value;
  if (adminToken) {
    const decoded = verifyToken(adminToken);
    if (decoded?.isAdmin && decoded?.userId) {
      return { ok: true, userId: decoded.userId as number };
    }
  }
  return { ok: false, status: userId ? 403 : 401 };
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ worldId: string }> }
) {
  try {
    const { worldId } = await params;
    const db = await getDb();

    const [world] = await db.select().from(worlds).where(eq(worlds.id, worldId)).limit(1);
    if (!world) return NextResponse.json({ error: "World not found" }, { status: 404 });

    const auth = await isOwnerOrAdmin(request, { ...world, id: worldId });
    if (!auth.ok) {
      return NextResponse.json(
        { error: auth.status === 401 ? "Unauthorized" : "Forbidden" },
        { status: auth.status }
      );
    }

    let body: { chunks?: Array<{ chunkKey: string; placementsJson: unknown }> };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const chunks = body.chunks ?? [];
    if (!Array.isArray(chunks)) {
      return NextResponse.json({ error: "chunks must be an array" }, { status: 400 });
    }

    let [draftVersion] = await db
      .select()
      .from(worldVersions)
      .where(
        and(eq(worldVersions.worldId, worldId), eq(worldVersions.versionType, "draft"))
      )
      .limit(1);

    if (!draftVersion) {
      const versionId = generateId();
      const [latestPublished] = await db
        .select()
        .from(worldVersions)
        .where(
          and(eq(worldVersions.worldId, worldId), eq(worldVersions.versionType, "published"))
        )
        .limit(1);
      const nextVersion = (latestPublished?.versionNumber ?? 0) + 1;

      await db.insert(worldVersions).values({
        id: versionId,
        worldId,
        versionType: "draft",
        versionNumber: nextVersion,
      });
      [draftVersion] = await db
        .select()
        .from(worldVersions)
        .where(eq(worldVersions.id, versionId))
        .limit(1);
    }

    if (!draftVersion) {
      return NextResponse.json({ error: "Failed to resolve draft version" }, { status: 500 });
    }

    // Validate ownership: user can only place assets they own
    const assetIds = new Set<string>();
    for (const chunk of chunks) {
      const placementsJson = chunk.placementsJson ?? [];
      if (!Array.isArray(placementsJson)) continue;
      for (const p of placementsJson) {
        if (p && typeof p === "object" && (p as { assetId?: string }).assetId) {
          const aid = String((p as { assetId: string }).assetId).trim();
          if (aid && aid !== "unknown") assetIds.add(aid);
        }
      }
    }
    if (assetIds.size > 0) {
      const owned = await db
        .select({ assetId: userWorldAssets.assetId })
        .from(userWorldAssets)
        .where(
          and(
            eq(userWorldAssets.userId, auth.userId),
            inArray(userWorldAssets.assetId, Array.from(assetIds))
          )
        );
      const ownedSet = new Set(owned.map((r) => r.assetId));
      const unowned = Array.from(assetIds).filter((id) => !ownedSet.has(id));
      if (unowned.length > 0) {
        return NextResponse.json(
          { error: `You do not own these assets. Purchase them first: ${unowned.join(", ")}` },
          { status: 403 }
        );
      }
    }

    await db
      .delete(worldChunkPlacements)
      .where(eq(worldChunkPlacements.worldVersionId, draftVersion.id));

    for (const chunk of chunks) {
      const chunkKey = String(chunk.chunkKey ?? "").slice(0, 20);
      if (!chunkKey) continue;

      const placementsJson = chunk.placementsJson ?? [];
      if (!Array.isArray(placementsJson) && typeof placementsJson !== "object") continue;

      await db.insert(worldChunkPlacements).values({
        id: generateId(),
        worldVersionId: draftVersion.id,
        chunkKey,
        placementsJson: placementsJson as unknown[],
      });
    }

    try {
      await emitPlatformEvent(
        "world_draft_saved",
        { worldId, versionId: draftVersion.id, chunkCount: chunks.length },
        auth.userId
      );
    } catch {
      // Don't fail save if event emission fails
    }

    return NextResponse.json({
      success: true,
      versionId: draftVersion.id,
      chunkCount: chunks.length,
    });
  } catch (e) {
    console.error("[api/worlds/[worldId]/draft PUT]", e);
    return NextResponse.json({ error: "Failed to save draft" }, { status: 500 });
  }
}
