import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { verifyToken } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { oasisWorldElements, oasisWorlds, oasisWorldEvents } from "@/lib/db/schema";
import { ensureOasisMarketTables } from "@/lib/oasis/market-db";
import { ensureOasisAssetColumns } from "@/lib/oasis/ensure-asset-columns";
import { validateWorldBlueprint } from "@/lib/oasis/world-blueprint-schema";
import { generateBlueprintFromPrompt } from "@/lib/oasis/world-blueprint-generator";
import { buildAssetMap } from "@/lib/oasis/asset-resolver";
import { runAssemblyPass } from "@/lib/oasis/assembly-pass";

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
  const prompt = String(body?.prompt ?? "").trim();
  const lockedObjectIds = Array.isArray(body?.lockedObjectIds)
    ? body.lockedObjectIds.map((x: unknown) => String(x))
    : [];
  const seed = typeof body?.seed === "number" ? body.seed : undefined;
  const regenIndex = typeof body?.regenIndex === "number" ? body.regenIndex : 0;

  if (!prompt) return NextResponse.json({ error: "prompt is required" }, { status: 400 });

  const adminUserId = Number((admin as { userId?: number }).userId ?? (admin as { id?: number }).id ?? 0);

  try {
    const db = await getDb();
    await ensureOasisMarketTables(db);
    await ensureOasisAssetColumns(db);

    const [world] = await db.select().from(oasisWorlds).where(eq(oasisWorlds.id, worldId));
    if (!world) return NextResponse.json({ error: "World not found" }, { status: 404 });

    const elements = await db
      .select({
        id: oasisWorldElements.id,
        name: oasisWorldElements.name,
        assetUri: oasisWorldElements.assetUri,
        tags: oasisWorldElements.tags,
        assetBounds: oasisWorldElements.assetBounds,
        defaultScale: oasisWorldElements.defaultScale,
        colliderType: oasisWorldElements.colliderType,
        isReady: oasisWorldElements.isReady,
      })
      .from(oasisWorldElements);

    const filtered = elements.filter(
      (e) =>
        e.assetUri &&
        (e.assetUri.endsWith(".glb") || e.assetUri.endsWith(".gltf") || e.assetUri.startsWith("ipfs://")) &&
        (e.isReady === true || e.isReady === undefined) // generator only picks ready assets
    );

    let blueprint = generateBlueprintFromPrompt(worldId, prompt, filtered, {
      seed,
      regenIndex,
      lockedObjectIds: lockedObjectIds.length > 0 ? lockedObjectIds : undefined,
    });

    const assetMap = buildAssetMap(filtered);
    const fallbackId = filtered[0]?.id ?? null;
    blueprint = runAssemblyPass(blueprint, { assetMap, fallbackAssetId: fallbackId });

    const validated = validateWorldBlueprint(blueprint);

    await db.insert(oasisWorldEvents).values({
      worldId,
      eventType: "world_gen_requested",
      payload: JSON.stringify({ prompt, seed: validated.seed, objectCount: validated.objects.length }),
      createdByUserId: adminUserId,
    });

    const readinessHash = crypto.createHash("sha256").update(JSON.stringify(validated)).digest("hex").slice(0, 32);

    await db.insert(oasisWorldEvents).values({
      worldId,
      eventType: "world_gen_completed",
      payload: JSON.stringify({ readinessHash, objectCount: validated.objects.length }),
      createdByUserId: adminUserId,
    });

    return NextResponse.json({
      blueprint: validated,
      readinessHash,
      message: `Generated ${validated.objects.length} objects. Publish to save as a version.`,
    });
  } catch (err) {
    console.error("[admin/oasis/worlds/generate]", err);
    return NextResponse.json({ error: "Generation failed" }, { status: 500 });
  }
}
