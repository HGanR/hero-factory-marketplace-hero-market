import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { verifyToken } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { oasisWorldElements, oasisWorlds, oasisWorldVersions, oasisWorldEvents } from "@/lib/db/schema";
import { ensureOasisMarketTables } from "@/lib/oasis/market-db";
import { ensureOasisAssetColumns } from "@/lib/oasis/ensure-asset-columns";
import { validateWorldBlueprint } from "@/lib/oasis/world-blueprint-schema";
import { buildAssetMap, resolveElementToAsset } from "@/lib/oasis/asset-resolver";
import { runAssemblyPass } from "@/lib/oasis/assembly-pass";
import { preflightUrl } from "@/lib/oasis/asset-preflight";

function requireAdmin(req: NextRequest) {
  const token = req.cookies.get("admin-token")?.value;
  if (!token) return null;
  const decoded = verifyToken(token);
  if (!decoded?.isAdmin) return null;
  return decoded;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ worldId: string }> }
) {
  const admin = requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { worldId } = await params;
  if (!worldId) return NextResponse.json({ error: "worldId required" }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const rawBlueprint = body?.blueprint;
  if (!rawBlueprint) return NextResponse.json({ error: "blueprint is required" }, { status: 400 });

  const adminUserId = Number((admin as { userId?: number }).userId ?? (admin as { id?: number }).id ?? 0);

  try {
    const db = await getDb();
    await ensureOasisMarketTables(db);
    await ensureOasisAssetColumns(db);

    let blueprint = validateWorldBlueprint(rawBlueprint);

    const elements = await db
      .select({
        id: oasisWorldElements.id,
        name: oasisWorldElements.name,
        assetUri: oasisWorldElements.assetUri,
        tags: oasisWorldElements.tags,
        assetBounds: oasisWorldElements.assetBounds,
        defaultScale: oasisWorldElements.defaultScale,
        colliderType: oasisWorldElements.colliderType,
        resolvedUrl: oasisWorldElements.resolvedUrl,
      })
      .from(oasisWorldElements);
    const filtered = elements.filter((e) => e.assetUri && (e.assetUri.endsWith(".glb") || e.assetUri.endsWith(".gltf") || e.assetUri.startsWith("ipfs://")));
    const assetMap = buildAssetMap(filtered);
    const fallbackId = filtered[0]?.id ?? null;

    const uniqueAssetIds = [...new Set(blueprint.objects.map((o) => o.assetRef).filter((r): r is number => typeof r === "number"))];
    for (const assetId of uniqueAssetIds) {
      const el = elements.find((e) => e.id === assetId);
      if (!el) continue;
      const resolved = resolveElementToAsset(el);
      const ok = await preflightUrl(resolved.url);
      if (ok) {
        await db
          .update(oasisWorldElements)
          .set({
            resolvedUrl: resolved.url,
            resolvedUrlUpdatedAt: new Date(),
          })
          .where(eq(oasisWorldElements.id, assetId));
      } else {
        const objIdx = blueprint.objects.findIndex((o) => o.assetRef === assetId);
        if (objIdx >= 0 && fallbackId) blueprint.objects[objIdx] = { ...blueprint.objects[objIdx], assetRef: fallbackId };
      }
    }

    blueprint = runAssemblyPass(blueprint, { assetMap, fallbackAssetId: fallbackId });
    if (blueprint.worldId !== worldId) {
      return NextResponse.json({ error: "blueprint.worldId must match URL" }, { status: 400 });
    }

    const [world] = await db.select().from(oasisWorlds).where(eq(oasisWorlds.id, worldId));
    if (!world) return NextResponse.json({ error: "World not found" }, { status: 404 });

    const readinessHash = crypto.createHash("sha256").update(JSON.stringify(blueprint)).digest("hex").slice(0, 32);
    const versionId = crypto.randomUUID();

    await db.insert(oasisWorldVersions).values({
      id: versionId,
      worldId,
      sceneGraph: JSON.stringify(blueprint),
      seed: blueprint.seed,
      readinessHash,
      createdByUserId: adminUserId,
    });

    await db.insert(oasisWorldEvents).values({
      worldId,
      eventType: "version_published",
      payload: JSON.stringify({ versionId, readinessHash }),
      createdByUserId: adminUserId,
    });

    return NextResponse.json({
      ok: true,
      versionId,
      readinessHash,
      message: "World version published.",
    });
  } catch (err) {
    console.error("[admin/oasis/worlds/publish]", err);
    return NextResponse.json({ error: "Publish failed" }, { status: 500 });
  }
}
