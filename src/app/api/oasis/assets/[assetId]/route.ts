import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { oasisWorldElements } from "@/lib/db/schema";
import { ensureOasisAssetColumns } from "@/lib/oasis/ensure-asset-columns";
import { resolveElementToAsset } from "@/lib/oasis/asset-resolver";

/**
 * GET /api/oasis/assets/:assetId
 * Resolve assetRef to loadable URL + metadata for the renderer.
 * assetId = oasis_world_elements.id (numeric).
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ assetId: string }> }
) {
  const { assetId } = await params;
  const id = parseInt(assetId, 10);
  if (Number.isNaN(id) || id < 1) {
    return NextResponse.json({ error: "Invalid assetId" }, { status: 400 });
  }

  try {
    const db = await getDb();
    await ensureOasisAssetColumns(db);

    const [el] = await db
      .select()
      .from(oasisWorldElements)
      .where(eq(oasisWorldElements.id, id))
      .limit(1);

    if (!el?.assetUri) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }

    const resolved = resolveElementToAsset(el);
    return NextResponse.json(resolved);
  } catch (err) {
    console.error("[oasis/assets]", err);
    return NextResponse.json({ error: "Failed to resolve asset" }, { status: 500 });
  }
}
