/**
 * GET /api/worlds/[worldId] — World metadata
 * Optional header X-Wallet-Address: when world has ownerWallet, canEdit is true if wallet matches
 */
import { NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { getAuthedUserId } from "@/lib/api/auth";
import { getWorldById } from "@/lib/api/worlds-helpers";

function normalizeAddress(addr: string | null | undefined): string | null {
  if (!addr || typeof addr !== "string") return null;
  const a = addr.trim().toLowerCase();
  return a.startsWith("0x") && a.length === 42 ? a : null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ worldId: string }> }
) {
  try {
    const { worldId } = await params;
    const userId = await getAuthedUserId();
    const walletHeader = request.headers.get("x-wallet-address");
    const connectedWallet = normalizeAddress(walletHeader);
    const db = await getDb();

    const world = await getWorldById(db, worldId);

    if (!world) return NextResponse.json({ error: "World not found" }, { status: 404 });

    const isOwnerByUser = userId !== null && Number(world.ownerId) === userId;
    let ownerWallet: string | null = null;
    let createdAt: Date | null = null;
    let updatedAt: Date | null = null;
    try {
      const [rows] = (await db.execute(sql`SELECT ownerWallet, createdAt, updatedAt FROM worlds WHERE id = ${worldId} LIMIT 1`)) as any;
      const row = Array.isArray(rows) ? rows[0] : rows?.rows?.[0];
      if (row) {
        ownerWallet = row.ownerWallet ?? null;
        createdAt = row.createdAt ?? null;
        updatedAt = row.updatedAt ?? null;
      }
    } catch {
      try {
        const [rows] = (await db.execute(sql`SELECT createdAt, updatedAt FROM worlds WHERE id = ${worldId} LIMIT 1`)) as any;
        const row = Array.isArray(rows) ? rows[0] : rows?.rows?.[0];
        if (row) {
          createdAt = row.createdAt ?? null;
          updatedAt = row.updatedAt ?? null;
        }
      } catch {
        // timestamps may not exist
      }
    }
    const isOwnerByWallet =
      ownerWallet &&
      connectedWallet &&
      normalizeAddress(ownerWallet) === connectedWallet;
    const canEdit = isOwnerByUser || !!isOwnerByWallet;
    const isPublic = world.visibility === "public" || world.visibility === "unlisted";
    const isPublished = world.status === "published";

    if (!canEdit && (!isPublic || !isPublished)) {
      return NextResponse.json({ error: "World not found" }, { status: 404 });
    }

    return NextResponse.json({
      world: {
        id: world.id,
        name: world.name,
        description: world.description,
        visibility: world.visibility,
        terrainSeed: world.terrainSeed,
        biomeType: world.biomeType,
        status: world.status,
        ownerId: canEdit ? world.ownerId : undefined,
        ownerWallet: canEdit ? ownerWallet ?? undefined : undefined,
        nftContractAddress: undefined,
        nftTokenId: undefined,
        saleStatus: undefined,
        canEdit,
        createdAt: createdAt?.toISOString?.(),
        updatedAt: updatedAt?.toISOString?.(),
      },
    });
  } catch (e) {
    console.error("[api/worlds/[worldId] GET]", e);
    const detail = process.env.NODE_ENV === "development" ? String((e as Error).message) : undefined;
    return NextResponse.json({ error: "Failed to load world", ...(detail && { detail }) }, { status: 500 });
  }
}

/**
 * PATCH /api/worlds/[worldId] — Update world metadata (owner only)
 * Body: { ownerWallet?, nftContractAddress?, nftTokenId?, saleStatus?, name?, description?, visibility? }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ worldId: string }> }
) {
  try {
    const { worldId } = await params;
    const userId = await getAuthedUserId();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const db = await getDb();
    const world = await getWorldById(db, worldId);
    if (!world) return NextResponse.json({ error: "World not found" }, { status: 404 });
    if (Number(world.ownerId) !== userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const updates: Record<string, unknown> = {};
    if (body.ownerWallet !== undefined) {
      const v = typeof body.ownerWallet === "string" ? body.ownerWallet.trim() : null;
      updates.ownerWallet = v && v.length === 42 ? v : null;
    }
    if (body.nftContractAddress !== undefined) {
      const v = typeof body.nftContractAddress === "string" ? body.nftContractAddress.trim() : null;
      updates.nftContractAddress = v && v.length === 42 ? v : null;
    }
    if (body.nftTokenId !== undefined) {
      updates.nftTokenId = typeof body.nftTokenId === "string" ? body.nftTokenId.trim() || null : null;
    }
    if (body.saleStatus !== undefined && ["not_listed", "listed", "sold"].includes(String(body.saleStatus))) {
      updates.saleStatus = body.saleStatus;
    }
    if (body.name !== undefined && typeof body.name === "string" && body.name.trim()) {
      updates.name = body.name.trim();
    }
    if (body.description !== undefined) {
      updates.description = typeof body.description === "string" ? body.description.trim() || null : null;
    }
    if (body.visibility !== undefined && ["private", "public", "unlisted", "token_gated"].includes(String(body.visibility))) {
      updates.visibility = body.visibility;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ world: { id: world.id } });
    }

    const setParts: ReturnType<typeof sql>[] = [];
    if (updates.name !== undefined) setParts.push(sql`name = ${String(updates.name)}`);
    if (updates.description !== undefined) setParts.push(sql`description = ${updates.description as string | null}`);
    if (updates.visibility !== undefined) setParts.push(sql`visibility = ${String(updates.visibility)}`);
    if (setParts.length > 0) {
      await db.execute(sql`UPDATE worlds SET ${sql.join(setParts, sql`, `)} WHERE id = ${worldId}`);
    }
    const updated = await getWorldById(db, worldId);
    return NextResponse.json({
      world: {
        id: updated?.id ?? world.id,
        name: updated?.name ?? world.name,
        ownerWallet: undefined,
        nftContractAddress: undefined,
        nftTokenId: undefined,
        saleStatus: undefined,
      },
    });
  } catch (e) {
    console.error("[api/worlds/[worldId] PATCH]", e);
    return NextResponse.json({ error: "Failed to update world" }, { status: 500 });
  }
}
