/**
 * GET /api/admin/oasis/elements/coverage
 * Admin-only: library coverage metric for modeling page badge.
 */
import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { verifyToken } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { oasisWorldElements, oasisElementCategories } from "@/lib/db/schema";
import { ensureOasisAssetColumns } from "@/lib/oasis/ensure-asset-columns";

function requireAdmin(req: NextRequest) {
  const token = req.cookies.get("admin-token")?.value;
  if (!token) return null;
  const decoded = verifyToken(token);
  return decoded?.isAdmin ? decoded : null;
}

export async function GET(req: NextRequest) {
  const admin = requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const db = await getDb();
    await ensureOasisAssetColumns(db);

    const all = await db
      .select({
        id: oasisWorldElements.id,
        name: oasisWorldElements.name,
        categoryId: oasisWorldElements.categoryId,
        isReady: oasisWorldElements.isReady,
        assetUri: oasisWorldElements.assetUri,
      })
      .from(oasisWorldElements);

    const withAsset = all.filter(
      (e) =>
        e.assetUri &&
        (e.assetUri.endsWith(".glb") || e.assetUri.endsWith(".gltf") || e.assetUri.startsWith("ipfs://"))
    );
    const ready = withAsset.filter((e) => e.isReady === true || e.isReady === undefined);
    const notReady = withAsset.filter((e) => e.isReady === false);

    const categories = await db.select().from(oasisElementCategories);
    const byCategory: Record<string, { total: number; ready: number }> = {};
    for (const c of categories) {
      const catElements = withAsset.filter((e) => e.categoryId === c.id);
      byCategory[c.slug || c.name] = {
        total: catElements.length,
        ready: catElements.filter((e) => e.isReady === true || e.isReady === undefined).length,
      };
    }

    const pct = withAsset.length > 0 ? Math.round((ready.length / withAsset.length) * 100) : 100;

    return NextResponse.json({
      total: withAsset.length,
      ready: ready.length,
      notReady: notReady.length,
      pctReady: pct,
      byCategory,
    });
  } catch (err) {
    console.error("[oasis/elements/coverage]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 500 }
    );
  }
}
