import { NextRequest, NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { verifyToken } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { oasisWorlds, oasisWorldVersions } from "@/lib/db/schema";
import { ensureOasisMarketTables } from "@/lib/oasis/market-db";

function requireAdmin(req: NextRequest) {
  const token = req.cookies.get("admin-token")?.value;
  if (!token) return null;
  const decoded = verifyToken(token);
  if (!decoded?.isAdmin) return null;
  return decoded;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ worldId: string }> }
) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { worldId } = await params;
  if (!worldId) return NextResponse.json({ error: "worldId required" }, { status: 400 });

  const limit = Math.min(50, Math.max(1, Number(new URL(req.url).searchParams.get("limit")) || 20));

  try {
    const db = await getDb();
    await ensureOasisMarketTables(db);
    const [world] = await db.select().from(oasisWorlds).where(eq(oasisWorlds.id, worldId));
    if (!world) return NextResponse.json({ error: "World not found" }, { status: 404 });

    const versions = await db
      .select({
        id: oasisWorldVersions.id,
        worldId: oasisWorldVersions.worldId,
        seed: oasisWorldVersions.seed,
        readinessHash: oasisWorldVersions.readinessHash,
        createdAt: oasisWorldVersions.createdAt,
      })
      .from(oasisWorldVersions)
      .where(eq(oasisWorldVersions.worldId, worldId))
      .orderBy(desc(oasisWorldVersions.createdAt))
      .limit(limit);

    return NextResponse.json({
      worldId,
      worldName: world.name,
      versions,
    });
  } catch (err) {
    console.error("[admin/oasis/worlds/versions]", err);
    return NextResponse.json({ error: "Failed to list versions" }, { status: 500 });
  }
}
