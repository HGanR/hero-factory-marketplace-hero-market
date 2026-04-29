import { NextRequest, NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { oasisWorlds, oasisWorldVersions } from "@/lib/db/schema";
import { ensureOasisMarketTables } from "@/lib/oasis/market-db";

/**
 * GET /api/oasis/worlds/:worldId
 * Returns latest published version with sceneGraph for the viewer.
 * Public - world must be published.
 * Query: ?versionId=xxx to load a specific version.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ worldId: string }> }
) {
  const { worldId } = await params;
  if (!worldId) return NextResponse.json({ error: "worldId required" }, { status: 400 });

  const url = new URL(req.url);
  const versionId = url.searchParams.get("versionId");

  try {
    const db = await getDb();
    await ensureOasisMarketTables(db);

    const [world] = await db
      .select()
      .from(oasisWorlds)
      .where(eq(oasisWorlds.id, worldId))
      .limit(1);

    if (!world) return NextResponse.json({ error: "World not found" }, { status: 404 });
    if (!world.isPublished) {
      return NextResponse.json({ error: "World is not published" }, { status: 403 });
    }

    let version;
    if (versionId) {
      const [v] = await db
        .select({
          id: oasisWorldVersions.id,
          worldId: oasisWorldVersions.worldId,
          sceneGraph: oasisWorldVersions.sceneGraph,
          seed: oasisWorldVersions.seed,
          readinessHash: oasisWorldVersions.readinessHash,
          createdAt: oasisWorldVersions.createdAt,
        })
        .from(oasisWorldVersions)
        .where(eq(oasisWorldVersions.id, versionId))
        .limit(1);
      if (!v || v.worldId !== worldId) {
        return NextResponse.json({ error: "Version not found" }, { status: 404 });
      }
      version = v;
    } else {
      const [v] = await db
        .select({
          id: oasisWorldVersions.id,
          worldId: oasisWorldVersions.worldId,
          sceneGraph: oasisWorldVersions.sceneGraph,
          seed: oasisWorldVersions.seed,
          readinessHash: oasisWorldVersions.readinessHash,
          createdAt: oasisWorldVersions.createdAt,
        })
        .from(oasisWorldVersions)
        .where(eq(oasisWorldVersions.worldId, worldId))
        .orderBy(desc(oasisWorldVersions.createdAt))
        .limit(1);
      if (!v) {
        return NextResponse.json(
          { error: "No published version yet. Generate and publish from the Modeling page." },
          { status: 404 }
        );
      }
      version = v;
    }

    const sceneGraph = JSON.parse(version.sceneGraph || "{}");

    return NextResponse.json({
      worldId: world.id,
      worldName: world.name,
      versionId: version.id,
      seed: version.seed,
      readinessHash: version.readinessHash,
      createdAt: version.createdAt,
      sceneGraph,
    });
  } catch (err) {
    console.error("[oasis/worlds]", err);
    return NextResponse.json({ error: "Failed to load world" }, { status: 500 });
  }
}
