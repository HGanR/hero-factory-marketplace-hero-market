/**
 * POST /api/worlds/[worldId]/publish — Publish draft to public version
 * Owner or admin only. Copies draft placements into published version.
 */
import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { worlds, worldVersions, worldChunkPlacements } from "@/lib/db/schema.worlds";
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

export async function POST(
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

    const [draftVersion] = await db
      .select()
      .from(worldVersions)
      .where(
        and(eq(worldVersions.worldId, worldId), eq(worldVersions.versionType, "draft"))
      )
      .limit(1);

    if (!draftVersion) {
      return NextResponse.json(
        { error: "No draft version found. Save a draft first." },
        { status: 400 }
      );
    }

    const draftChunks = await db
      .select()
      .from(worldChunkPlacements)
      .where(eq(worldChunkPlacements.worldVersionId, draftVersion.id));

    let [publishedVersion] = await db
      .select()
      .from(worldVersions)
      .where(
        and(eq(worldVersions.worldId, worldId), eq(worldVersions.versionType, "published"))
      )
      .limit(1);

    if (!publishedVersion) {
      const versionId = generateId();
      await db.insert(worldVersions).values({
        id: versionId,
        worldId,
        versionType: "published",
        versionNumber: 1,
      });
      [publishedVersion] = await db
        .select()
        .from(worldVersions)
        .where(eq(worldVersions.id, versionId))
        .limit(1);
    }

    if (!publishedVersion) {
      return NextResponse.json({ error: "Failed to create published version" }, { status: 500 });
    }

    await db
      .delete(worldChunkPlacements)
      .where(eq(worldChunkPlacements.worldVersionId, publishedVersion.id));

    for (const chunk of draftChunks) {
      await db.insert(worldChunkPlacements).values({
        id: generateId(),
        worldVersionId: publishedVersion.id,
        chunkKey: chunk.chunkKey,
        placementsJson: chunk.placementsJson,
      });
    }

    await db
      .update(worlds)
      .set({ status: "published", updatedAt: new Date() })
      .where(eq(worlds.id, worldId));

    try {
      await emitPlatformEvent(
        "world_published",
        {
          worldId,
          worldName: world.name,
          versionId: publishedVersion.id,
          chunkCount: draftChunks.length,
          ownerId: world.ownerId,
        },
        auth.userId
      );
    } catch {
      // Don't fail publish if event emission fails
    }

    const baseUrl =
      request.nextUrl?.origin ??
      process.env.NEXT_PUBLIC_APP_URL ??
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null);
    const shareUrl = baseUrl ? `${baseUrl}/worlds/${worldId}` : null;

    return NextResponse.json({
      success: true,
      versionId: publishedVersion.id,
      chunkCount: draftChunks.length,
      shareUrl,
    });
  } catch (e) {
    console.error("[api/worlds/[worldId]/publish POST]", e);
    return NextResponse.json({ error: "Failed to publish" }, { status: 500 });
  }
}
