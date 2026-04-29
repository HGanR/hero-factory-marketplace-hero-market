/**
 * GET /api/worlds/[worldId]/data — World data: metadata, version, chunk placements, reserved zones
 */
import { NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { getAuthedUserId } from "@/lib/api/auth";
import { getWorldById } from "@/lib/api/worlds-helpers";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ worldId: string }> }
) {
  try {
    const { worldId } = await params;
    const userId = await getAuthedUserId();
    const db = await getDb();

    const world = await getWorldById(db, worldId);
    if (!world) return NextResponse.json({ error: "World not found" }, { status: 404 });

    const isOwner = userId !== null && Number(world.ownerId) === userId;
    const isPublic = world.visibility === "public" || world.visibility === "unlisted";
    const isPublished = world.status === "published";

    if (!isOwner && (!isPublic || !isPublished)) {
      return NextResponse.json({ error: "World not found" }, { status: 404 });
    }

    const versionType = isOwner ? "draft" : "published";
    let version: { id: string; versionType: string; versionNumber: number } | null = null;
    let placements: Array<{ chunkKey: string; placementsJson: unknown }> = [];
    let reservedZones: Array<{ id: string; zoneType: string; boundsJson: unknown }> = [];

    try {
      const [versionRows] = (await db.execute(
        sql`SELECT id, versionType, versionNumber FROM world_versions WHERE worldId = ${worldId} AND versionType = ${versionType} LIMIT 1`
      )) as any;
      version = Array.isArray(versionRows) ? versionRows[0] : versionRows?.rows?.[0] ?? versionRows;
    } catch {
      // world_versions may not exist
    }

    if (version) {
      try {
        const [chunkRows] = (await db.execute(
          sql`SELECT chunkKey, placementsJson FROM world_chunk_placements WHERE worldVersionId = ${version.id}`
        )) as any;
        const chunks = Array.isArray(chunkRows) ? chunkRows : chunkRows?.rows ?? chunkRows ?? [];
        placements = (Array.isArray(chunks) ? chunks : [chunks]).map((c: { chunkKey: string; placementsJson: unknown }) => ({
          chunkKey: c.chunkKey,
          placementsJson: c.placementsJson,
        }));
      } catch {
        // world_chunk_placements may not exist
      }
    }

    try {
      const [zoneRows] = (await db.execute(
        sql`SELECT id, zoneType, boundsJson FROM world_reserved_zones WHERE worldId = ${worldId} OR worldId IS NULL`
      )) as any;
      const zones = Array.isArray(zoneRows) ? zoneRows : zoneRows?.rows ?? zoneRows ?? [];
      reservedZones = (Array.isArray(zones) ? zones : [zones]).map((z: { id: string; zoneType: string; boundsJson: unknown }) => ({
        id: z.id,
        zoneType: z.zoneType,
        boundsJson: z.boundsJson,
      }));
    } catch {
      // world_reserved_zones may not exist
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
      },
      version: version
        ? {
            id: version.id,
            versionType: version.versionType,
            versionNumber: version.versionNumber ?? 1,
          }
        : null,
      chunks: placements,
      reservedZones,
    });
  } catch (e) {
    console.error("[api/worlds/[worldId]/data GET]", e);
    return NextResponse.json({ error: "Failed to load world data" }, { status: 500 });
  }
}
