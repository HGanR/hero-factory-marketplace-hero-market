import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { verifyToken } from "@/lib/auth";
import { oasisWorldElements, oasisWorlds } from "@/lib/db/schema";
import { ensureOasisMarketTables } from "@/lib/oasis/market-db";
import { ensureOasisAssetColumns } from "@/lib/oasis/ensure-asset-columns";
import { validateWorldBlueprint } from "@/lib/oasis/world-blueprint-schema";
import { generateBlueprintFromPrompt } from "@/lib/oasis/world-blueprint-generator";
import { buildAssetMap } from "@/lib/oasis/asset-resolver";
import { runAssemblyPass } from "@/lib/oasis/assembly-pass";

/** Admin bypasses Tier 7 check. */
function isAdmin(req: NextRequest): boolean {
  const token = req.cookies.get("admin-token")?.value;
  if (!token) return false;
  const decoded = verifyToken(token);
  return !!decoded?.isAdmin;
}

/**
 * Public API: generate a world blueprint from prompt (AI World Generator).
 * Requires Tier 7 (Hero token ID 7) or admin. World must be published.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const worldId = String(body?.worldId ?? "").trim();
    const prompt = String(body?.prompt ?? "").trim();
    const walletAddress = typeof body?.walletAddress === "string" ? body.walletAddress.trim() : null;
    const signature = typeof body?.signature === "string" ? body.signature.trim() : null;
    const nonce = typeof body?.nonce === "string" ? body.nonce.trim() : null;
    const issuedAt = typeof body?.issuedAt === "string" ? body.issuedAt.trim() : null;
    const regenIndex = typeof body?.regenIndex === "number" ? body.regenIndex : 0;

    if (!isAdmin(req)) {
      if (!walletAddress) {
        return NextResponse.json(
          { error: "Tier 7 required. Connect wallet on the Modeling page." },
          { status: 403 }
        );
      }
      if (!signature || !nonce || !issuedAt) {
        return NextResponse.json(
          { error: "Signed message required. Sign the Tier 7 access message when generating." },
          { status: 403 }
        );
      }
      const { verifySignature, verifyTier7: checkTier7 } = await import("@/lib/oasis/tier7-verify");
      const sigOk = await verifySignature({
        walletAddress,
        signature,
        nonce,
        action: "GENERATE",
        worldId,
        issuedAt,
      });
      if (!sigOk) {
        return NextResponse.json({ error: "Invalid signature. Please sign again." }, { status: 403 });
      }
      const { consumeNonce } = await import("@/lib/auth/nonce-consume");
      const nonceOk = await consumeNonce(walletAddress, nonce);
      if (!nonceOk) {
        return NextResponse.json({ error: "Nonce expired or already used." }, { status: 403 });
      }
      const hasTier7 = await checkTier7(walletAddress);
      if (!hasTier7) {
        return NextResponse.json(
          { error: "Tier 7 required. Connect a wallet with Hero token ID 7 on Polygon." },
          { status: 403 }
        );
      }
    }
    const lockedObjectIds = Array.isArray(body?.lockedObjectIds)
      ? body.lockedObjectIds.map((x: unknown) => String(x))
      : [];
    const seed = typeof body?.seed === "number" ? body.seed : undefined;

    if (!worldId) return NextResponse.json({ error: "worldId is required" }, { status: 400 });
    if (!prompt) return NextResponse.json({ error: "prompt is required" }, { status: 400 });

    const db = await getDb();
    await ensureOasisMarketTables(db);
    await ensureOasisAssetColumns(db);

    const [world] = await db
      .select()
      .from(oasisWorlds)
      .where(eq(oasisWorlds.id, worldId));
    if (!world) return NextResponse.json({ error: "World not found" }, { status: 404 });
    if (!world.isPublished) {
      return NextResponse.json({ error: "World is not published" }, { status: 403 });
    }

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
        (e.assetUri.endsWith(".glb") ||
          e.assetUri.endsWith(".gltf") ||
          e.assetUri.startsWith("ipfs://")) &&
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

    return NextResponse.json({
      blueprint: validated,
      message: `Generated ${validated.objects.length} objects. Sign in as admin to publish as a version.`,
    });
  } catch (err) {
    console.error("[oasis/blueprint/generate]", err);
    return NextResponse.json({ error: "Generation failed" }, { status: 500 });
  }
}
